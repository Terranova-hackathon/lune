using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Lune.Auth.Contracts;
using Lune.Auth.Options;
using Lune.Auth.Data;
using Lune.Auth.Services;
using Lune.Shared.Identity;
using Lune.Shared.Validation;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace Lune.Auth.Endpoints;

public static class AuthEndpoints
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", Register)
            .WithName("Register")
            .WithSummary("Register")
            .WithDescription(
                "Create an account and sign in. On success the server sets the HttpOnly auth cookie, so no separate login is needed. " +
                "Password: at least 8 characters, with an uppercase letter, a lowercase letter, a digit and a symbol. " +
                "Email must not already be registered. Display name is optional; if given, it must be unique. " +
                "`acceptedPrivacyPolicy` must be `true`. Validation errors return 400, keyed by field or by Identity error code.")
            .Produces<UserResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem();

        group.MapPost("/login", Login)
            .WithName("Login")
            .WithSummary("Login")
            .WithDescription(
                "Sign in with email and password. On success the server sets the HttpOnly auth cookie (valid for 24 hours) " +
                "and returns the user. A wrong password and an unknown email both return the same 401, " +
                "so the response does not reveal whether an account exists.")
            .Produces<UserResponse>(StatusCodes.Status200OK)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapPost("/logout", Logout)
            .WithName("Logout")
            .WithSummary("Logout")
            .WithDescription("Sign out by clearing the auth cookie. Always returns 204, even if no one is signed in.")
            .Produces(StatusCodes.Status204NoContent);

        group.MapGet("/me", GetCurrentUser).RequireAuthorization()
            .WithName("Get Current User")
            .WithSummary("Get Current User")
            .WithDescription(
                "Return the signed-in user. Use it to check whether the auth cookie is still valid, for example on page load. " +
                "`displayName` is null if the user never set one. Returns 401 if not signed in, the session has expired, " +
                "or the account no longer exists. Requires sign-in.")
            .Produces<UserResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized);

        group.MapPut("/profile", UpdateProfile).RequireAuthorization()
            .WithName("Update Profile")
            .WithSummary("Update Profile")
            .WithDescription(
                "Change the signed-in user's display name. The name is trimmed, must be 2–20 characters, and must not be " +
                "used by another account (case-insensitive). Returns the updated user. Requires sign-in.")
            .Produces<UserResponse>(StatusCodes.Status200OK)
            .ProducesValidationProblem()
            .Produces(StatusCodes.Status401Unauthorized);

        group.MapDelete("/delete-account", DeleteAccount).RequireAuthorization()
            .WithName("Delete Account")
            .WithSummary("Delete Account")
            .WithDescription(
                "Permanently delete the signed-in user's account and all of their data, including saved favorites, " +
                "then clear the auth cookie. This cannot be undone. Requires sign-in.")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesValidationProblem();


        //TODO: decide if we want to make add this end points as well.
        // group.MapPost("/forgot-password", ForgotPassword);
    }

    /// <summary>
    /// these end points only do jwt for now, will need to make a new genaric interface and add the other Services like OAuth if we want to add other login methods.
    /// </summary>
    private static async Task<IResult> Register(
        RegisterRequest req,
        UserManager<AppUser> users,
        JwtTokenService tokens,
        IOptions<JwtOptions> jwtOptions,
        HttpContext context)
    {
        if (!RequestValidator.TryValidate(req, out var errors))
        {
            return Results.ValidationProblem(errors);
        }

        var displayName = string.IsNullOrWhiteSpace(req.DisplayName) ? null : req.DisplayName.Trim();
        if (displayName is not null &&
            await users.Users.AnyAsync(u => u.DisplayName == displayName))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                { "DisplayName", new[] { "This display name is already in use." } }
            });
        }

        var user = new AppUser
        {
            Email = req.Email,
            UserName = req.Email,
            DisplayName = displayName,
            PrivacyConsentedAtUtc = DateTime.UtcNow,
        };

        var res = await users.CreateAsync(user, req.Password);

        ///<summary>
        /// Groups errors together by their code so no duplicate error messages are returned.
        /// </summary>
        if (!res.Succeeded)
        {
            return Results.ValidationProblem(res.Errors
                .GroupBy(e => e.Code.StartsWith("Password") ? "Password" : "Email")
                .ToDictionary(
                    group => group.Key,
                    group => group
                        // UserName is the email, so a taken email reports both codes: show it once.
                        .Select(e => e.Code is "DuplicateUserName" or "DuplicateEmail"
                            ? "An account with this email already exists."
                            : e.Description)
                        .Distinct()
                        .ToArray()));
        }

        AuthCookies.SetAuthCookie(context, jwtOptions.Value, tokens.CreateToken(user));
        return Results.Created("/api/auth/me", MakeResponse(user));
    }

    ///<summary>
    /// Simple Auth for getting the user and trying to validate the password.
    /// we can addd more validations  in the future if needed. eg. login attempts tracking.
    /// </summary>
    private static async Task<IResult> Login(
        LoginRequest req,
        UserManager<AppUser> users,
        JwtTokenService tokens,
        IOptions<JwtOptions> jwtOptions,
        HttpContext context)
    {
        if (!RequestValidator.TryValidate(req, out var errors))
        {
            return Results.ValidationProblem(errors);
        }

        var user = await users.FindByEmailAsync(req.Email);
        if (user == null || !await users.CheckPasswordAsync(user, req.Password))
        {
            return InvalidCredentials();
        }

        AuthCookies.SetAuthCookie(context, jwtOptions.Value, tokens.CreateToken(user));
        return Results.Ok(MakeResponse(user));
    }


    private static async Task<IResult> Logout(IOptions<JwtOptions> jwtOptions, HttpContext context)
    {
        AuthCookies.ClearAuthCookie(context, jwtOptions.Value);
        return await Task.FromResult(Results.NoContent());
    }


    /// <summary>
    /// Gets the current authenticated user based on the JWT token in the request.
    /// The user id is read with the shared <see cref="UserClaims.GetUserId"/> helper (the JWT "sub" claim).
    /// </summary>
    private static async Task<IResult> GetCurrentUser(ClaimsPrincipal principal, UserManager<AppUser> users)
    {
        var id = principal.GetUserId();

        if (id == null)
            return Results.Unauthorized();

        var user = await users.FindByIdAsync(id);

        if (user == null)
            return Results.Unauthorized();

        return Results.Ok(MakeResponse(user));
    }

    private static async Task<IResult> DeleteAccount(
        ClaimsPrincipal principal,
        UserManager<AppUser> users,
        IEnumerable<IUserDataCleaner> cleaners,
        IOptions<JwtOptions> jwtOptions,
        HttpContext context)
    {
        var id = principal.GetUserId();
        if (id is null)
            return Results.Unauthorized();

        var user = await users.FindByIdAsync(id);
        if (user is null)
            return Results.Unauthorized();

        var result = await users.DeleteAsync(user);
        if (!result.Succeeded)
        {
            return Results.ValidationProblem(result.Errors
                .GroupBy(error => error.Code)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(error => error.Description).ToArray()));
        }

        // The login is already gone, so clean up other modules' data without the request token:
        // a client disconnect must not leave orphaned rows behind.
        foreach (var cleaner in cleaners)
        {
            await cleaner.DeleteUserDataAsync(id, CancellationToken.None);
        }

        AuthCookies.ClearAuthCookie(context, jwtOptions.Value);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateProfile(
        UpdateProfileDisplayNameRequest req,
        ClaimsPrincipal principal,
        UserManager<AppUser> users)
    {
        if (!RequestValidator.TryValidate(req, out var errors))
        {
            return Results.ValidationProblem(errors);
        }

        var id = principal.GetUserId();
        if (id is null)
            return Results.Unauthorized();

        var user = await users.FindByIdAsync(id);
        if (user is null)
            return Results.Unauthorized();

        var displayName = req.DisplayName.Trim();

        if (displayName == user.DisplayName)
            return Results.Ok(MakeResponse(user));

        var existingUser = await users.Users.AnyAsync(u => u.DisplayName == displayName && u.Id != id);
        if (existingUser)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                { "DisplayName", new[] { "This display name is already in use." } }
            });
        }

        user.DisplayName = displayName;
        var result = await users.UpdateAsync(user);

        if (!result.Succeeded)
        {
            return Results.ValidationProblem(result.Errors
                .GroupBy(error => error.Code)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(error => error.Description).ToArray()));
        }

        return Results.Ok(MakeResponse(user));
    }

    //     private static async Task ForgotPassword(HttpContext context)
    // {
    //     // TODO: Implement Forgot Password logic here
    //     await context.Response.WriteAsync("Forgot password endpoint");
    // }

    internal static IResult InvalidCredentials() =>
        Results.Problem(
            title: "Invalid email or password.",
            statusCode: StatusCodes.Status401Unauthorized);

    internal static UserResponse MakeResponse(AppUser user) =>
        new(user.Id, user.Email ?? string.Empty, user.DisplayName);
}
