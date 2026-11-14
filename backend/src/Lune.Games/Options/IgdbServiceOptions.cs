namespace Lune.Games.Options;

internal sealed class IgdbServiceOptions
{
    public const string SectionName = "Igdb";
    public string ClientId { get; set; } = string.Empty;
    public string ApiSecret {get; set;} = string.Empty;
    public string BaseUrl { get; set; } = "https://api.igdb.com/v4/";
    public string TokenUrl { get; set;} = "https://id.twitch.tv/oauth2/token";
    // The Idgb data base doesnt give me a full url path so i have to build it my self. 
    public string ImageBaseUrl {get; set ;} = "https://images.igdb.com/igdb/image/upload";
    public string VideoBaseUrl { get; set; } = "https://www.youtube.com/watch?v=";
    public int GameDetailsCacheMinutes { get; set; } = 10;
    public int SearchCacheMinutes { get; set; } = 5;
    public int FeaturedCacheMinutes { get; set; } = 10;
    public int FilterOptionsCacheMinutes { get; set; } = 10;
}