# RAMSC Info Services - AI-Powered Study Assistant

Automated info-services for medical students, researchers, and learners at Ramathibodi Medical School. This system provides three main workflows:

1. **Upload → Parse → Index**: Process PDF documents and create searchable knowledge base
2. **Generate Study Pack**: AI-powered generation of summaries, flashcards, and MCQs
3. **Adaptive Scheduler**: Spaced repetition system with daily study recommendations

## 🏗️ Architecture

- **Frontend**: Static HTML/CSS/JS website with study dashboard
- **Backend**: Node.js API with Express framework
- **Database**: PostgreSQL with vector extensions (Supabase recommended)
- **AI Services**: OpenAI API for embeddings and content generation
- **Notifications**: Email (SendGrid), LINE, Telegram integration
- **Scheduling**: Node-cron for automated tasks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+ (with vector extension)
- OpenAI API key
- SendGrid account (for emails)
- Optional: LINE/Telegram bot tokens

### 1. Environment Setup

```bash
# Clone the repository
cd urseamajoris.github.io

# Install API dependencies
cd api
npm install

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `api/.env`:

```env
# Database (Use Supabase for easy setup)
DATABASE_URL=postgresql://user:password@host:5432/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# JWT Secret (generate a strong random string)
JWT_SECRET=your_jwt_secret_key_here

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Email notifications
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@ramsc.edu

# Optional: Messaging platforms
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
TELEGRAM_BOT_TOKEN=your_telegram_token
```

### 3. Database Setup

#### Option A: Supabase (Recommended)

1. Create a new Supabase project
2. Enable the `vector` extension in SQL Editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Run the schema file:
   ```bash
   psql -f api/config/schema.sql "your_supabase_connection_string"
   ```

#### Option B: Local PostgreSQL

```bash
# Install PostgreSQL and pgvector extension
# Then run:
createdb ramsc_info_services
psql ramsc_info_services -f api/config/schema.sql
```

### 4. Start the Services

```bash
# Start the API server
cd api
npm start

# Serve the frontend (in another terminal)
cd ..
python3 -m http.server 8080
```

Visit `http://localhost:8080/study-dashboard.html` to access the study interface.

## 📋 Features

### Flow 1: Document Processing
- PDF upload via web interface or API
- Automatic text extraction and OCR fallback
- Intelligent text chunking (500 tokens)
- Vector embeddings generation
- Searchable knowledge base

### Flow 2: AI Study Generation
- RAG-based content retrieval
- Automated summary generation
- Flashcard creation (question/answer pairs)
- Multiple choice questions with explanations
- Topic-based organization

### Flow 3: Adaptive Learning
- Spaced repetition algorithm (SM-2)
- Daily study pack generation
- Weak topic identification
- Performance analytics
- Multi-channel notifications

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/validate` - Validate JWT token

### Document Management
- `POST /api/upload/file` - Upload PDF file
- `POST /api/upload/upload-complete` - Process uploaded file from URL
- `GET /api/upload/sources` - List user's documents
- `GET /api/upload/status/:sourceId` - Check processing status

### Study Packs
- `POST /api/study-pack/generate` - Generate new study pack
- `GET /api/study-pack` - List user's study packs
- `GET /api/study-pack/:id` - Get specific study pack
- `POST /api/study-pack/response` - Submit study response

### Scheduler
- `GET /api/scheduler/daily` - Get today's study pack
- `GET /api/scheduler/due` - Get items due for review
- `GET /api/scheduler/weak-topics` - Get topics needing practice
- `GET /api/scheduler/stats` - Get study statistics

## 🎯 Deployment

### Option 1: Vercel + Supabase (Recommended)

1. **Frontend**: Deploy to Vercel
   ```bash
   # In the root directory
   vercel deploy
   ```

2. **Backend**: Deploy API as Vercel Functions
   ```bash
   # Create api/vercel.json
   {
     "functions": {
       "index.js": {
         "maxDuration": 30
       }
     }
   }
   ```

3. **Database**: Use Supabase (already configured)

### Option 2: Traditional VPS

```bash
# Example deployment with PM2
npm install -g pm2

# Start API server
cd api
pm2 start index.js --name "ramsc-api"

# Serve frontend with nginx
# Configure nginx to serve static files and proxy /api to the backend
```

### Option 3: Docker

```dockerfile
# api/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📚 Usage Examples

### Upload and Process Document

```javascript
// Upload PDF file
const formData = new FormData();
formData.append('pdf', file);
formData.append('title', 'Anatomy Chapter 1');
formData.append('tags', JSON.stringify(['anatomy', 'basics']));

const response = await fetch('/api/upload/file', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
```

### Generate Study Pack

```javascript
// Create study pack for specific topics
const response = await fetch('/api/study-pack/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    topics: ['cardiovascular system', 'pharmacology'],
    difficulty: 3
  })
});
```

### Get Daily Study Recommendations

```javascript
// Get today's personalized study pack
const response = await fetch('/api/scheduler/daily', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

const dailyPack = await response.json();
// Contains mix of due reviews, weak topics, and new content
```

## 🔒 Security Considerations

- JWT tokens for authentication
- Input validation on all endpoints
- File type restrictions (PDF only)
- Rate limiting recommended for production
- Environment variables for sensitive data
- CORS configuration for cross-origin requests

## 🧪 Testing

```bash
# Run tests (when implemented)
cd api
npm test

# Health check
curl http://localhost:3000/api/health
```

## 📈 Monitoring

- Monitor API response times and error rates
- Track study engagement metrics
- Monitor vector database performance
- Set up alerts for failed scheduled jobs

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Create GitHub issue
- Contact RAMSC development team
- Email: rama.med@gmail.com

---

Built with ❤️ for Ramathibodi Medical Students
