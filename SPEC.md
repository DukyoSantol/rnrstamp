# Document Stamping System - Specification

## Project Overview
- **Project Name**: RNR Document Stamping System
- **Type**: Web Application (Node.js + Express + pdf-lib)
- **Core Functionality**: Upload PDF files and apply a "RECEIVED" stamp with customizable fields
- **Target Users**: Office staff, records personnel

## UI/UX Specification

### Layout Structure
- **Header**: Fixed top bar with logo/title
- **Main Content**: Centered container (max-width: 900px)
  - Upload section (left/top)
  - Form inputs section (right/bottom)
  - Preview section (full width below)
- **Responsive Breakpoints**:
  - Mobile: < 640px (stacked layout)
  - Tablet: 640px - 1024px (two columns)
  - Desktop: > 1024px (optimized spacing)

### Visual Design

#### Color Palette
- **Background**: #f8f9fa (light gray)
- **Card Background**: #ffffff
- **Primary**: #2c3e50 (dark blue-gray)
- **Accent**: #e74c3c (red for stamp)
- **Text Primary**: #1a1a2e
- **Text Secondary**: #6c757d
- **Border**: #dee2e6
- **Success**: #28a745
- **Stamp Color**: #1a1a1a (rubber stamp black)

#### Typography
- **Font Family**: 'Crimson Pro' for headings, 'Source Sans Pro' for body
- **Heading (H1)**: 28px, weight 600
- **Subheading**: 18px, weight 500
- **Body**: 14px, weight 400
- **Form Labels**: 13px, weight 600, uppercase
- **Stamp Text**: Custom rendering with specific sizes

#### Spacing System
- **Section Padding**: 24px
- **Card Padding**: 20px
- **Form Group Margin**: 16px
- **Element Gap**: 12px

#### Visual Effects
- **Card Shadow**: 0 4px 6px rgba(0,0,0,0.07)
- **Hover Transitions**: 0.2s ease
- **Button Hover**: Darken by 10%
- **File Drop Zone**: Dashed border, highlight on dragover

### Components

#### Upload Zone
- Drag & drop area with dashed border
- File input button
- States: default, dragover (highlighted), uploaded (shows filename)
- Accepted: .pdf files only
- Max size: 50MB

#### Form Fields
- Document Number: text input (required)
- Date: date picker (required, default: today)
- Time: time picker (required, default: current time)
- Received By: text input (optional)
- Stamp Position: dropdown (Bottom-Right, Bottom-Left, Top-Right, Top-Left, Center)
- Page Selection: radio (All Pages, First Page Only)

#### Action Buttons
- "Process PDF" - Primary button, full width on mobile
- "Download Stamped PDF" - Success color, appears after processing
- "Reset" - Secondary/outline button

#### Preview Section
- Embedded PDF viewer (iframe or embed)
- Shows processed PDF before download
- Loading spinner during processing

## Functionality Specification

### Core Features

1. **PDF Upload**
   - Accept PDF files via drag-drop or file picker
   - Validate file type (PDF only)
   - Validate file size (max 50MB)
   - Store temporarily on server

2. **Stamp Configuration**
   - All required fields validated before processing
   - Date/time defaults to current values
   - Position selection affects stamp placement
   - Page selection (all vs first)

3. **Stamp Rendering**
   - Header: "MGB XI - Davao City" (8pt)
   - Main Text: "RECEIVED" (36pt, bold, red/dark)
   - Subtext: "Records and Releasing Unit" (10pt)
   - Field values formatted in table-like structure
   - Rubber stamp effect: slightly transparent, slight rotation (-5 to -10 degrees)
   - Default position: bottom-right with 50px margin

4. **PDF Processing**
   - Load original PDF with pdf-lib
   - Create stamp as embedded page/image
   - Overlay stamp on each page (based on selection)
   - Maintain original quality
   - Handle multi-page PDFs

5. **Output**
   - Generate processed PDF in memory
   - Send as base64 for preview
   - Allow download with "stamped_" prefix

### User Interactions
1. User drags/selects PDF file
2. System validates and shows filename
3. User fills in stamp details
4. User clicks "Process PDF"
5. System processes and shows preview
6. User clicks "Download" to save

### Edge Cases
- Empty required fields: Show validation errors
- Invalid file type: Show error message
- File too large: Show size limit error
- Corrupted PDF: Show error, allow retry
- Processing failure: Show error with retry option

## Technical Implementation

### Backend (Node.js + Express)
- **PDF Library**: pdf-lib
- **File Upload**: Multer
- **Routes**:
  - POST /api/upload - Handle file upload
  - POST /api/process - Process PDF with stamp
  - GET /api/preview/:id - Get preview (optional)
  - DELETE /api/cleanup/:id - Clean up temp files

### Stamp Positioning Logic
- Bottom-Right: x = pageWidth - stampWidth - margin, y = margin
- Bottom-Left: x = margin, y = margin
- Top-Right: x = pageWidth - stampWidth - margin, y = pageHeight - stampHeight - margin
- Top-Left: x = margin, y = pageHeight - stampHeight - margin
- Center: x = (pageWidth - stampWidth) / 2, y = (pageHeight - stampHeight) / 2

### File Handling
- Temp files stored with unique IDs
- Auto-cleanup after 1 hour
- In-memory processing preferred

## Acceptance Criteria

1. ✓ User can upload a PDF file
2. ✓ User can input Document Number, Date, Time, Received By
3. ✓ Stamp appears with all required text elements
4. ✓ Stamp has rubber stamp appearance (black/gray, transparent)
5. ✓ Stamp positioned correctly based on selection
6. ✓ Stamp appears on all pages or first page only
7. ✓ Preview shows stamped PDF before download
8. ✓ Downloaded PDF has stamp applied
9. ✓ Original PDF quality maintained
10. ✓ Multi-page PDFs handled correctly
