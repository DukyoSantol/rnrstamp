# RNR Document Stamping System

A web-based system for applying "RECEIVED" stamps to PDF documents.

## Features

- Upload PDF files (up to 50MB)
- Apply customizable stamp with:
  - Header: "MGB XI - Davao City"
  - Large "RECEIVED" text
  - Subtext: "Records and Releasing Unit"
  - Document fields: Doc. No, Date, Time, Received By
- Configurable stamp position (bottom-right, bottom-left, top-right, top-left, center)
- Option to apply stamp to all pages or first page only
- Preview stamped PDF before downloading
- Download stamped PDF with original quality preserved

## Running the Application

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open browser to: http://localhost:3000

## Deployment (Render.com - Free)

1. Push code to GitHub
2. Go to https://render.com and sign up
3. Click "New Web Service"
4. Connect your GitHub repo
5. Settings:
   - Name: rnr-stamp
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free
6. Click "Deploy"

Your app will be online at: `https://rnr-stamp.onrender.com` (or similar)

## Project Structure

```
RNR/
├── server.js          # Express backend with PDF processing
├── public/
│   ├── index.html     # Main HTML page
│   ├── style.css      # Styling
│   └── app.js         # Frontend JavaScript
├── package.json
└── SPEC.md            # Specification document
```

## API Endpoints

- `POST /api/upload` - Upload PDF file
- `POST /api/process` - Process PDF with stamp
- `DELETE /api/cleanup/:fileId` - Clean up temp files