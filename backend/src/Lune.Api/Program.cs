using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.OpenApi;
using Scalar.AspNetCore;
using Lune.Games;
using Lune.Auth;
using Lune.Favorites;
using Lune.Prices;
using Lune.Shared.Modules;

/// <summary>
/// Entry point for the Lune API application.
/// </summary>

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks()
    .AddDbContextCheck<Lune.Auth.Data.AuthDbContext>("database");

// Backend Docs Config
builder.Services.AddOptions<ScalarOptions>().BindConfiguration("Scalar");

// OpenAPI Backend Documentation Summary
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, ct) =>
    {
        document.Info.Title = "Lune Backend API";
        document.Info.Version = "v1";
        document.Info.Contact = new OpenApiContact
        {
            Name = "Lune Backend API for LunaNova Games Site",
            Url = new Uri("https://lunanova.games"),
        };
        document.Info.Description = """
                ![Lune](/icons/eclipse/apple-touch-icon.png)

                Backend for **LunaNova**, a game search site. Anyone can search and browse games;
                signed-in users can also save games to their favorites.

                Game data comes from [IGDB](https://www.igdb.com/). Prices come from Steam and
                [GG.deals](https://gg.deals/), currently for the Italian region only.

                ## Authentication

                Sign-in uses a JWT in an **HttpOnly cookie** (`Lune_auth`), not an `Authorization` header.
                `POST /api/auth/register` or `POST /api/auth/login` sets the cookie, and the browser sends it
                automatically from then on. Sessions last 24 hours; `POST /api/auth/logout` ends one.
                Endpoints marked "Requires sign-in" return `401` without a valid cookie.

                Accounts need a password of at least 8 characters with an uppercase letter, a lowercase letter,
                a digit and a symbol. Display names are optional, 2–20 characters, and unique.

                ## Conventions

                - **Game IDs** are IGDB IDs, shared by Games, Favorites and Prices.
                - **Paging:** list endpoints take `page` (from 1) and `pageSize` (1–40) and return
                `items`, `page`, `pageSize`, `totalCount` and `totalPages`.
                - **Errors** use [Problem Details](https://www.rfc-editor.org/rfc/rfc9457). Invalid input
                returns `400` with an `errors` object; most keys are field names, but password and
                duplicate-email errors use ASP.NET Identity codes (e.g. `PasswordRequiresUpper`).
                - **503** means an outside provider (IGDB, Steam or GG.deals) didn't respond. Retrying later
                usually works.
                """;

        var tagDescriptions = new Dictionary<string, string>
        {
            ["Games"] = "Search the IGDB catalog, get a game's full details, and load the values the search filters accept. No sign-in needed.",
            ["Auth"] = "Create an account, sign in and out, and manage the signed-in user's profile.",
            ["Favorites"] = "The signed-in user's saved games, up to 1,000 per user. Requires sign-in.",
            ["Prices"] = "Current and lowest-recorded prices on Steam and GG.deals, for games sold on Steam. Italian region only.",
            ["Health"] = "Checks for monitoring and Docker.",
        };

        document.Tags ??= new HashSet<OpenApiTag>();
        foreach (var (name, description) in tagDescriptions)
        {
            var tag = document.Tags.FirstOrDefault(t => t.Name == name);
            if (tag is null)
                document.Tags.Add(new OpenApiTag { Name = name, Description = description });
            else
                tag.Description = description;
        }
        return Task.CompletedTask;
    });
});

var modules = new IModule[] { new GamesModule(), new AuthModule(), new FavoritesModule(), new PricesModule() };

foreach (var m in modules) m.AddServices(builder.Services, builder.Configuration);

var app = builder.Build();

foreach (var m in modules) await m.InitializeAsync(app.Services);

app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference("/docs", options =>
    {
        options
            .WithTitle("Lune Backend API Reference")
            .WithFavicon("/favicon.ico")
            .WithTheme(ScalarTheme.BluePlanet)
            .WithDefaultHttpClient(ScalarTarget.CSharp, ScalarClient.HttpClient);
    });
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => "ok")
    .WithTags("Health")
    .WithName("Health Check")
    .WithSummary("Health Check")
    .WithDescription(
        "Liveness check for monitoring and Docker. Returns the plain-text string `ok` when the API process is running. " +
        "It does not check the database or external providers.")
    .Produces<string>(StatusCodes.Status200OK, "text/plain");

app.MapGet("/health/ready", async (HealthCheckService health, CancellationToken ct) =>
    {
        var report = await health.CheckHealthAsync(ct);
        var body = new
        {
            status = report.Status.ToString(),
            checks = report.Entries.ToDictionary(e => e.Key, e => e.Value.Status.ToString()),
        };
        return report.Status == HealthStatus.Healthy
            ? Results.Ok(body)
            : Results.Json(body, statusCode: StatusCodes.Status503ServiceUnavailable);
    })
    .WithTags("Health")
    .WithName("Readiness Check")
    .WithSummary("Readiness Check")
    .WithDescription(
        "Checks that the API can reach its database. Returns 200 with `status: Healthy` when ready, " +
        "or 503 with the failing check when not. Use for readiness probes; `/health` only checks that the process is up.")
    .Produces(StatusCodes.Status200OK)
    .Produces(StatusCodes.Status503ServiceUnavailable);

Lune.Api.LandingPage.Map(app);

foreach (var m in modules) m.MapEndpoints(app);

app.Run();
