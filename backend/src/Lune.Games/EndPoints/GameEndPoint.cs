using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using System.ComponentModel;
using Lune.Shared.Games.Contracts;
using Lune.Shared.Paging;
using Lune.Games.Services;

namespace Lune.Games.EndPoints;

public static class GameEndPoint
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 40;

    public static void Map(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/games")
            .WithTags("Games")
            .WithSummary("Game Data Retrieval Endpoints")
            .WithDescription("Game Data Retrieval Endpoints");

        group.MapGet("/", Search)
            .WithName("Main Search")
            .WithSummary("Search Games")
            .WithDescription(
                "Search the game catalog by name, filters, or both. With no search term, the most-rated games are listed first; " +
                "with a search term, results are sorted by name. `ordering` overrides either default. " +
                "Within one filter, values are OR-ed (any listed genre matches); different filters are AND-ed. " +
                "Games without a release date or rating are never included.")
            .Produces<PagedResult<GameSummary>>(StatusCodes.Status200OK)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapGet("/{id:int}", GetById)
            .WithName("Get Game By ID")
            .WithSummary("Get Game By ID")
            .WithDescription(
                "Full details for one game: summary, storyline, genres, platforms, developers, publishers, " +
                "store links, and media as ready-to-use URLs (cover, 1080p screenshots and artwork, YouTube videos). " +
                "`backgroundImage` is a randomly chosen screenshot, so it can differ between calls. " +
                "Also includes a paged list of similar games in `relatedGames`; `page` and `pageSize` page through that list only.")
            .Produces<GameDetails>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapGet("/filters", GetFilters)
            .WithName("Get Filter Options")
            .WithSummary("Get Filter Options")
            .WithDescription(
                "Everything the search filters accept, for building the filter UI. Each option has a `value` to send " +
                "and a `name` to display. `genres` lists all Game Database genres(value = slug, for the `genres` parameter)." +
                "`platforms` lists the platforms Lune supports (value = platform ID, for the `platforms` parameter). " +
                "`orderings` lists the sort orders for the `ordering` parameter. Cached on the server for 10 minutes.")
            .Produces<GameFilterOptions>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapGet("/companies", SearchCompanies)
            .WithName("Search Companies")
            .WithSummary("Search Companies")
            .WithDescription(
                "Find developers or publishers by name, for example to fill a filter autocomplete. Matches anywhere in " +
                "the name, case-insensitive. Returns up to 10 companies, those with the most games first. " +
                "Pass a result's `slug` to the `developers` or `publishers` parameter of `GET /api/games`.")
            .Produces<IReadOnlyList<CompanyOption>>(StatusCodes.Status200OK)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapGet("/featured", GetFeatured)
            .WithName("Get Featured Games")
            .WithSummary("Get Featured Games")
            .WithDescription(
                "10 games picked at random from the 50 most-rated on Game Database, for the home page.The selection changes on every call. " +
                "Each item has the same shape as `GET /api/games/{id}`, but `relatedGames` is always empty and " +
                "`backgroundImage` is the game's first 1080p screenshot (or its cover).")
            .Produces<IReadOnlyList<GameDetails>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
    }

    private static async Task<IResult> Search(
        IGamesService games,
        [Description("Text to match anywhere in the game name. Leave empty to browse the most-rated games.")]
        string? search,
        [Description("Page number, starting at 1.")]
        int page = 1,
        [Description("Results per page, 1–40. Default 20.")]
        int pageSize = DefaultPageSize,
        [Description("Comma-separated genre slugs, up to 10. Get valid values from `GET /api/games/filters`.")]
        string? genres = null,
        [Description("Comma-separated platform IDs, up to 10. Example: `6,167` (PC, PlayStation 5). Get valid values from `GET /api/games/filters`.")]
        string? platforms = null,
        [Description("Comma-separated developer slugs, up to 10. Get slugs from `GET /api/games/companies?kind=developer`.")]
        string? developers = null,
        [Description("Comma-separated publisher slugs, up to 10. Get slugs from `GET /api/games/companies?kind=publisher`.")]
        string? publishers = null,
        [Description("Sort order: `-rating`, `-metacritic`, `-released`, `released`, `-added` (most rated) or `name`. A leading `-` means descending. Default: most rated when browsing, name A–Z when searching.")]
        string? ordering = null,
        [Description("Minimum critic score, 0–100. Game Database has no Metacritic score, so this uses Game Database's critic rating.")]
        string? metacriticMin = null,
        [Description("Maximum critic score, 0–100. Must not be lower than `metacriticMin`.")]
        string? metacriticMax = null,
        CancellationToken cancellationToken = default)
    {
        var filters = GameSearchFilterParser.Parse(
            genres, platforms, developers, publishers, ordering, metacriticMin, metacriticMax, out var errors);
        if (filters is null)
            return Results.ValidationProblem(errors);

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        try
        {
            return Results.Ok(await games.SearchAsync(search, page, pageSize, filters, cancellationToken));
        }
        catch (GamesUnavailableException e)
        {
            return Unavailable(e);
        }
    }

    private static async Task<IResult> GetById(
        [Description("Game Database game ID. The same ID works with /api/favorites and /api/prices.")]
        int id,
        IGamesService games,
        [Description("Page of related games, starting at 1.")]
        int page = 1,
        [Description("Related games per page, 1–40. Default 6.")]
        int pageSize = 6,
        CancellationToken cancellationToken = default)
    {
        try
        {
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

            var game = await games.GetByIdAsync(id, page, pageSize, cancellationToken);
            return game is null ? Results.NotFound() : Results.Ok(game);
        }
        catch (GamesUnavailableException ex)
        {
            return Results.Problem(
                title: "Game data is currently unavailable.",
                detail: ex.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    /// <summary>
    /// Grabs all the filterable options form the third party API so the front end can diplsay all the filter options.
    /// </summary>
    private static async Task<IResult> GetFilters(IGamesService games, CancellationToken cancellationToken)
    {
        try
        {
            return Results.Ok(await games.GetFilterOptionsAsync(cancellationToken));
        }
        catch (GamesUnavailableException e)
        {
            return Unavailable(e);
        }
    }

    private static async Task<IResult> SearchCompanies(
        IGamesService games,
        CancellationToken cancellationToken,
        [Description("Required. `developer` or `publisher`.")]
        string? kind = null,
        [Description("Required. Part of the company name, 2–60 characters. Example: `ubi`.")]
        string? search = null)
    {
        var errors = new Dictionary<string, string[]>();
        var companyKind = kind?.Trim().ToLowerInvariant() switch
        {
            "developer" => CompanyKind.Developer,
            "publisher" => CompanyKind.Publisher,
            _ => (CompanyKind?)null
        };
        if (companyKind is null)
            errors["kind"] = ["kind must be 'developer' or 'publisher'."];

        var term = search?.Trim() ?? string.Empty;
        if (term.Length is < 2 or > 60)
            errors["search"] = ["search must be between 2 and 60 characters."];

        if (errors.Count > 0)
            return Results.ValidationProblem(errors);

        try
        {
            return Results.Ok(await games.SearchCompaniesAsync(companyKind!.Value, term, cancellationToken));
        }
        catch (GamesUnavailableException e)
        {
            return Unavailable(e);
        }
    }

    private static async Task<IResult> GetFeatured(
        IGamesService games, CancellationToken cancellationToken)
    {
        try
        {
            var featured = await games.GetFeaturedAsync(cancellationToken);
            return featured.Count == 0 ? Results.NotFound() : Results.Ok(featured);
        }
        catch (GamesUnavailableException e)
        {
            return Unavailable(e);
        }
    }

    private static IResult Unavailable(GamesUnavailableException e) =>
        Results.Problem(
            title: "Game data is currently unavailable.",
            detail: e.Message,
            statusCode: StatusCodes.Status503ServiceUnavailable);
}
