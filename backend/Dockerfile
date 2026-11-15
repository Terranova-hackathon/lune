# Pinned SDK version, so every build uses the same one. Update on purpose (and commit).
FROM mcr.microsoft.com/dotnet/sdk:10.0.404 AS dev

WORKDIR /app

COPY . .

EXPOSE 3001

CMD ["dotnet", "watch", "run", "--non-interactive", "--no-launch-profile", "--project", "src/Lune.Api", "--urls", "http://0.0.0.0:3001"]
