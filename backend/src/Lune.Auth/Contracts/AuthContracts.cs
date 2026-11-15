using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
namespace Lune.Auth.Contracts;

/// <summary>
/// Represents the login and register request sent from the frontend.
/// </summary>
public sealed record RegisterRequest(
    [property: Required, EmailAddress, Description("Account email. Also used to sign in.")]
    string Email,
    [property: Required, MinLength(8), Description("At least 8 characters, with an uppercase letter, a lowercase letter, a digit and a symbol.")]
    string Password,
    [property: Description("Optional public name. Must be unique if given; blank is treated as no name."), StringLength(20, MinimumLength = 2)]
    string? DisplayName,
    [property: Range(typeof(bool), "true", "true", ErrorMessage = "You must accept the privacy policy."), Description("Must be `true`.")]
    bool AcceptedPrivacyPolicy);

public sealed record LoginRequest(
    [property: Required, Description("The email the account was registered with.")]
    string Email,
    [property: Required, Description("The account password.")]
    string Password);

public sealed record UpdateProfileDisplayNameRequest(
    [property: Required, StringLength(20, MinimumLength = 2)] string DisplayName);

/// <summary>
/// Represents the response structure to the frontend.
/// </summary>
public sealed record UserResponse(
    [property: Required, Description("Unique user ID.")]
    string Id,
    [property: Required, Description("The account email.")]
    string Email,
    [property: Required, Description("Public display name, or null if not set.")]
    string? DisplayName);
