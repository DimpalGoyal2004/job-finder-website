# Hireway - Jobs and Internships Finder

A modern, responsive website to discover jobs and internships. It shows live listings from a public API, supports search and filters, and has a 3D-styled interface with a working login/signup demo.



![Hireway screenshot](screenshot.png)

## Features

- **Live job listings** fetched from the Remotive public API, with sample data as a fallback if the API is unavailable
- **Search** by keyword and location, and filter by jobs or internships
- **Browse by category** and one-click popular searches
- **Save jobs** to your account (heart button)
- **Signup and login** flow with form validation and PBKDF2 password hashing
- **3D interface**: hero scene with mouse parallax, card tilt on hover, animated stat counters
- **Polished UX**: loading skeletons, toast notifications, empty states
- **Responsive** on mobile, tablet and desktop, with reduced-motion support
- **Safe rendering**: API data is escaped to prevent XSS

## Tech Stack

- HTML5
- CSS3 (Grid, Flexbox, custom properties, 3D transforms, glassmorphism)
- Vanilla JavaScript (ES6+, async/await, Fetch API, IntersectionObserver, Web Crypto API, localStorage)
- Data source: [Remotive API](https://remotive.com/api/remote-jobs)

## Project Structure

```
hireway/
├── index.html    # Page structure and auth modal
├── style.css     # Styling, 3D effects, responsive design
├── script.js     # API calls, search, filters, saved jobs, animations
└── auth.js       # Signup, login, session handling
```

## Run Locally

1. Clone the repository
```bash
   git clone https://github.com/USERNAME/hireway.git
```
2. Open the folder in VS Code
3. Run `index.html` with the **Live Server** extension (needed for the Web Crypto API to work on localhost)

## What I Learned

- Fetching and normalizing data from a REST API with timeouts and error handling
- Building a client-side auth flow with validation and password hashing
- Creating 3D effects with CSS perspective and transforms
- Writing accessible, responsive UI with keyboard focus and reduced-motion support
- Escaping dynamic content to prevent XSS

## Note on Authentication

Login and signup are a **frontend demo**. User data is stored in the browser's localStorage, so please do not enter real passwords. A Node.js, Express and MongoDB backend with JWT authentication is planned as a next step.

## Roadmap

- [ ] Backend with real authentication (Node.js, Express, MongoDB)
- [ ] Saved jobs page
- [ ] More job sources, including India-focused listings
- [ ] Dark/light theme toggle

## Credits

Job data provided by [Remotive](https://remotive.com).

## Author

**Your Name**
[LinkedIn](https://linkedin.com/in/your-profile) | [GitHub](https://github.com/USERNAME)
