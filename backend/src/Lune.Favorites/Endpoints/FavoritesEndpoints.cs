using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using System.ComponentModel;
using Lune.Favorites.Data;
using Lune.Favorites.Services;
using Lune.Shared.Games;
using Lune.Shared.Identity;

using Lune.Shared.Paging;
using Lune.Shared.Games.Contracts;

namespace Lune.Favorites.Endpoints;


internal static class FavoritesEndpoints
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 40;

    public static void Map(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/favorites").RequireAuthorization()
            .WithTags("Favorites")
            .WithSummary(" Auth protected /favorites endpoints allow registered users to add/remove/view favorited games");

        group.MapGet("/", List)
            .WithName("List Favorites")
            .WithSummary("List Favorites")
            .WithDescription(
                "The signed-in user's saved games, newest first, in the same shape as search results. " +
                "Game details are a copy taken when the game was saved, so they still load if Game Database is unavailable " +
                "but may not reflect later changes. Requires sign-in.")
            .Produces<PagedResult<GameSummary>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized);

        group.MapGet("/ids", async (HttpContext http, FavoritesService favorites, CancellationToken cancellationToken) =>
            http.User.GetUserId() is { } userId
                ? Results.Ok(await favorites.IdsAsync(userId, cancellationToken))
                : Results.Unauthorized())
            .WithName("List Favorite IDs")
            .WithSummary("List Favorite IDs")
            .WithDescription(
                "The Game Database IDs of all the signed-in user's saved games, as one unpaged array in no particular order. " +
                "Use it to mark favorites in search results (for example a filled heart) without loading full game data. " +
                "Requires sign-in.")
            .Produces<IReadOnlyList<int>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized);

        group.MapPut("/{Id:int}", Add)
            .WithName("Add Favorite")
            .WithSummary("Add Favorite")
            .WithDescription(
                $"Save a game to the signed-in user's favorites. No request body. Safe to repeat: saving a game that is " +
                $"already a favorite also returns 201. Each user can save up to {FavoriteLimits.MaxPerUser} games (409 when full). " +
                $"Returns 404 if Game Database has no game with this ID. Requires sign-in.")
            .Produces(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapDelete("/{Id:int}", Remove)
            .WithName("Remove Favorite")
            .WithSummary("Remove Favorite")
            .WithDescription(
                "Remove a game from the signed-in user's favorites. Safe to repeat: returns 204 whether or not " +
                "the game was saved. Requires sign-in.")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status401Unauthorized);
    }

    private static async Task<IResult> List(
        HttpContext http,
        FavoritesService favorites,
        CancellationToken cancellationToken,
        [Description("Page number, starting at 1.")]
        int page = 1,
        [Description("Results per page, 1–40. Default 20.")]
        int pageSize = DefaultPageSize)
    {
        if (http.User.GetUserId() is not { } userId)
        {
            return Results.Unauthorized();
        }

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        return Results.Ok(await favorites.ListAsync(userId, page, pageSize, cancellationToken));
    }

    private static async Task<IResult> Add(
        [Description("Game Database game ID to save, the same ID used by /api/games.")]
        int Id,
        HttpContext http,
        FavoritesService favorites,
        CancellationToken cancellationToken)
    {
        if (http.User.GetUserId() is not { } userId)
        {
            return Results.Unauthorized();
        }

        if (Id <= 0)
        {
            return Results.NotFound();
        }

        try
        {
            return await favorites.AddAsync(userId, Id, cancellationToken) switch
            {
                AddFavoriteResult.GameNotFound => Results.NotFound(),
                AddFavoriteResult.LimitReached => Results.Problem(
                    title: "Favorites limit reached.",
                    detail: $"You can save up to {FavoriteLimits.MaxPerUser} favorites.",
                    statusCode: StatusCodes.Status409Conflict),
                _ => Results.Created(),
            };
        }
        catch (GameCatalogUnavailableException ex)
        {
            return Results.Problem(
                title: "Game data is currently unavailable.",
                detail: ex.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> Remove(
        [Description("Game Database ID to remove.")]
        int Id,
        HttpContext http,
        FavoritesService favorites,
        CancellationToken cancellationToken)
    {
        if (http.User.GetUserId() is not { } userId)
        {
            return Results.Unauthorized();
        }

        await favorites.RemoveAsync(userId, Id, cancellationToken);
        return Results.NoContent();
    }
}
