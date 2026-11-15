using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using System.ComponentModel;
using Lune.Prices.Services;
using Lune.Prices.Contracts;

namespace Lune.Prices.Endpoints;

public static class PriceEndPoint
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/prices").WithTags("Prices");

        group.MapGet("/{Id:int}", GetPriceComparison)
            .WithName("Get Price Comparison")
            .WithSummary("Get Price Comparison")
            .WithDescription(
                "Prices for a game on Steam and GG.deals, (currently only in the Italian region). Games are matched to stores by their Steam app ID, " +
                "so a game that IGDB doesn't link to Steam returns 404. Steam gives the current price only (`historicalLow` is null); " +
                "GG.deals gives the current price and the historical low. `averagePrice` is not filled in yet. " +
                "If one store fails, the other is still returned. 503 means no store returned a price; this currently also " +
                "happens for free games. Prices are cached for up to 6 hours.")
            .Produces<GamePriceComparison>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
    }

    private static async Task<IResult> GetPriceComparison(
        [Description("Game Database game ID, the same ID used by /api/games.")]
        int Id,
        MultiPlatformPriceService priceComparison,
        CancellationToken cancellationToken)
    {
        try
        {
            var comparison = await priceComparison.GetPriceComparisonAsync(Id, cancellationToken);
            if (comparison is null)
                return Results.Problem(
                    title: "No price data found.",
                    detail: "Pricing data is not available for this game yet.",
                    statusCode: StatusCodes.Status404NotFound);

            return Results.Ok(comparison);
        }
        catch (PricesUnavailableException ex)
        {
            return Unavailable(ex);
        }
    }

    private static IResult Unavailable(PricesUnavailableException ex) =>
        Results.Problem(
            title: "Price data is currently unavailable.",
            detail: ex.Message,
            statusCode: StatusCodes.Status503ServiceUnavailable);
}

