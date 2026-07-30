# Deployment

This project is configured for Render with a hosted MongoDB Atlas database.

1. Create a free MongoDB Atlas cluster and database user. In Atlas Network Access, allow Render to connect (temporarily `0.0.0.0/0` is simplest for a demo; restrict it later).
2. Copy the Atlas connection string and replace its password.
3. In Render, choose **New > Blueprint** and select this GitHub repository. Render reads `render.yaml` and creates the API plus the static frontend.
4. Set these API secrets in Render:
   - `MONGODB_URI`: your Atlas connection string
   - `GROQ_API_KEY`: your Groq API key
   - `TAVILY_API_KEY`: your Tavily API key
5. Deploy the API first, copy its `https://...onrender.com` URL, then set:
   - frontend `VITE_API_BASE_URL` to that API URL
   - API `FRONTEND_ORIGINS` to the frontend's Render URL
6. Redeploy the frontend after setting `VITE_API_BASE_URL`.

For the demo, use a saved report after deployment. The API service has a persistent disk for SQLite workflow state and the Chroma knowledge index; MongoDB Atlas stores user-owned records and reports.
