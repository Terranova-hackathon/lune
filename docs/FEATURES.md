# Product Features

This document is designed to outline all the features of the site, from a technical rather than user point of view. The goal is to show we have completed all the MVP features as well as a range of bonus features. Seperate into a high-level overview of functionality, then break down and show off particularly interersting engineering choices and implementations that may only be visible to developers.

Use the en.game_explorer.pdf and the following issue notes for context.

# MVP Checklist and Review

## Required Features

- [x] Home Page
    - [x] App Overview
    - [x]  Search Bar
    - [x] Selection of Video games (Featured?)
- [x] Basic Search
   - [x] video game by name (including partial)
   - [x] dynamic completion
- [x] Advanced Search using filters
    - [x] genre
    - [x] platform
    - [x] release year
    - [x] rating (metacritic score)
    - [x] sorting (name, release date, or rating)
- [x] Video Game List (or grid of cards), each selectable and with
    - [x] Cover image
    - [x] title
    - [x] release date
    - [x] average rating
    - [x] main platforms
- [x] # 72
    - [x] description
    - [x] images and screenshots
    - [x] genres
    - [x] platforms
    - [x] developer
    - [x] publisher
    - [x] rating
    - [x] metacritic score
- [x] Favorites (Dedicated section on site)
    - [x] user can add/remove favorites
    - [x] (optionally) stored in database
- [x] State Management
    - [x] Data loading indicator
    - [x] API error handling (ex. no favorites, no access)
    - [x] Message for null search results
- [x]  Responsive Design (work on mobile and desktop view)

## Technical Specifications

- [x] C#, ASP.NET Backend
- [x]  Angular, Typescript, Bootstrap Frontend
- [x] SQL Database
- [x] Git code versioning

## API Testing (Before connecting front-end and back end)

- [x] Verify all backend APIs with postman (using Bruno)
    - [x] Verify REST Endpoints
    - [x] Check status codes
    - [x] Analyze JSON responses
    - [x] Validate input parameters
    - [x] Simulate error conditions (verify handling)
- [x] Organize requests into collection to submit with project

## Submission

- [ ] Complete source code as git repository (with commit history)
- [ ] Technical documentation describing
    - [ ] Description of implemented features
    - [ ] Application architecture
    - [ ] Technologies Used
    - [ ] Design Choices
- [ ] 10 minute video presentation
    - [ ] illustrate main features of app
    - [ ] describe difficulties encountered and solutions adopted

## Presentation

- [ ] Each student should be able to
    - [ ] Describe application architecture
    - [ ] explain how features work
    - [ ] walk through code
    - [ ] justify design and tech choices made
    - [ ] modify code if requested

# Evaluation Criterion

# Bonus Features (Suggested)

- [x] User authentication with ASP.Net Core Identity w/ web tokens
    - [x] Register
    - [x] Login
    - [x] Access personal area
- [x] Dark/light mode
- [ ] Video Game Comparison
- [ ] Wish List (add/remove)
- [ ] Personal Statistics
    - [ ] number of games viewed
    - [ ] number of favorite games
    - [ ] distribution by genre
    - [ ] distribution by platform
    - [ ] highest rated video games

## Notes from Q&A

- user must have a frontend response for each possible state (loading, success( w/wo data), error)
- Metacritic is used for filtering instead of rating
- Frontend should have guards/interceptors for authentication

- Readme should explain:
- 1. what prereqs are required to be installed
- 2. how to create/configure the environment
- 3. what variables are required
- 4. how to start up front and backend
- 5. eventual initialization/migration of database

- GDPR is not required, but can be considered a bonus

# Notes from 2nd Q&A

## Development

- We can add additional functionality without approval (just make sure to document)
- Data cleaning is not expected (though removing low-quality results would be appreciated)
- We can use additional external APIs to fetch additional data (ex. STEAMAPI)

## Presentation & Documentation

- The Code freeze is Sunday night, ~~but we can add documentation until Monday night (ex. update README) -> Carefull! make explicit PR that touches only README, tag #Documentation~~ (correction: slack message clarified NO commits after Sunday)
- Presentation should be in text and video form (video is to aid in evaluation)
- All bonus features need to be explicitly listed and described
- Expect an Architectural Document (Outlining Design Choices)

- Would be cool to have a promo video

## Unrequested  features we have added

- there are a number to add
