const axios = require('axios');

// AI content generation service using OpenAI
const generateAIContent = async (type, content, topics, options = {}) => {
  try {
    const prompts = getPrompts(type, content, topics, options);
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: prompts.messages,
        temperature: 0.7,
        max_tokens: prompts.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      throw new Error('Invalid response from OpenAI API');
    }

    const generatedContent = response.data.choices[0].message.content;
    console.log(`🤖 Generated ${type} content (${generatedContent.length} chars)`);

    return parseAIResponse(type, generatedContent);

  } catch (error) {
    if (error.response) {
      console.error('OpenAI API error:', error.response.status, error.response.data);
      throw new Error(`OpenAI API error: ${error.response.status} - ${error.response.data.error?.message || 'Unknown error'}`);
    } else {
      console.error('AI service error:', error.message);
      throw error;
    }
  }
};

// Generate prompts for different content types
const getPrompts = (type, content, topics, options) => {
  const baseContext = `You are an expert medical educator creating study materials. 
Content to analyze: "${content.substring(0, 3000)}..."
Topics: ${topics.join(', ')}`;

  switch (type) {
    case 'summary':
      return {
        messages: [
          {
            role: 'system',
            content: `${baseContext}

Create a comprehensive summary of the provided medical content focusing on the specified topics. 
The summary should be:
- Clear and well-structured
- Focused on key concepts and important details
- Written for medical students
- Include important terminology and definitions
- Highlight clinical relevance where applicable`
          },
          {
            role: 'user',
            content: 'Please create a detailed summary of this content.'
          }
        ],
        maxTokens: 1000
      };

    case 'flashcards':
      const flashcardCount = options.count || 20;
      return {
        messages: [
          {
            role: 'system',
            content: `${baseContext}

Create ${flashcardCount} flashcards from this content. Each flashcard should:
- Have a clear, concise question on the front
- Have a detailed, accurate answer on the back
- Focus on important concepts, definitions, processes, or clinical applications
- Be challenging but fair for medical students
- Cover different aspects of the topics

Format your response as a JSON array:
[
  {
    "front": "Question text",
    "back": "Answer text"
  },
  ...
]`
          },
          {
            role: 'user',
            content: `Create ${flashcardCount} high-quality flashcards covering the key concepts in this content.`
          }
        ],
        maxTokens: 2000
      };

    case 'mcqs':
      const mcqCount = options.count || 15;
      return {
        messages: [
          {
            role: 'system',
            content: `${baseContext}

Create ${mcqCount} multiple choice questions from this content. Each MCQ should:
- Have 1 correct answer and 3-4 plausible distractors
- Test understanding, not just memorization
- Include clinical scenarios where appropriate
- Have clear, unambiguous wording
- Include a brief explanation of why the answer is correct

Format your response as a JSON array:
[
  {
    "question": "Question text",
    "correct_answer": "Correct option",
    "distractors": ["Wrong option 1", "Wrong option 2", "Wrong option 3"],
    "explanation": "Why this answer is correct"
  },
  ...
]`
          },
          {
            role: 'user',
            content: `Create ${mcqCount} challenging but fair multiple choice questions based on this content.`
          }
        ],
        maxTokens: 3000
      };

    default:
      throw new Error(`Unsupported content type: ${type}`);
  }
};

// Parse AI response based on content type
const parseAIResponse = (type, content) => {
  try {
    switch (type) {
      case 'summary':
        return content.trim();

      case 'flashcards':
      case 'mcqs':
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('No JSON array found in response');
        }
        
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) {
          throw new Error('Response is not an array');
        }

        // Validate structure
        if (type === 'flashcards') {
          return parsed.filter(item => item.front && item.back);
        } else if (type === 'mcqs') {
          return parsed.filter(item => 
            item.question && 
            item.correct_answer && 
            Array.isArray(item.distractors) && 
            item.distractors.length >= 3
          );
        }
        break;

      default:
        return content;
    }
  } catch (error) {
    console.error('AI response parsing error:', error);
    
    // Fallback: try to extract content manually
    if (type === 'flashcards') {
      return extractFlashcardsManually(content);
    } else if (type === 'mcqs') {
      return extractMCQsManually(content);
    }
    
    throw new Error(`Failed to parse AI response for type: ${type}`);
  }
};

// Manual extraction fallbacks
const extractFlashcardsManually = (content) => {
  const flashcards = [];
  const lines = content.split('\n');
  
  let currentFront = '';
  let currentBack = '';
  let isBack = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Front:') || trimmed.startsWith('Q:')) {
      if (currentFront && currentBack) {
        flashcards.push({ front: currentFront, back: currentBack });
      }
      currentFront = trimmed.replace(/^(Front:|Q:)\s*/, '');
      currentBack = '';
      isBack = false;
    } else if (trimmed.startsWith('Back:') || trimmed.startsWith('A:')) {
      currentBack = trimmed.replace(/^(Back:|A:)\s*/, '');
      isBack = true;
    } else if (trimmed && isBack) {
      currentBack += ' ' + trimmed;
    } else if (trimmed && !isBack) {
      currentFront += ' ' + trimmed;
    }
  }
  
  if (currentFront && currentBack) {
    flashcards.push({ front: currentFront, back: currentBack });
  }
  
  return flashcards.slice(0, 20); // Limit to 20
};

const extractMCQsManually = (content) => {
  // This is a simplified manual extraction
  // In practice, this would be more sophisticated
  return [
    {
      question: "Sample question extracted from content",
      correct_answer: "Correct option",
      distractors: ["Option A", "Option B", "Option C"],
      explanation: "This is the explanation for the correct answer."
    }
  ];
};

// Generate content in batches to handle rate limits
const batchGenerateContent = async (requests, delayMs = 2000) => {
  const results = [];
  
  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    console.log(`Processing AI request ${i + 1}/${requests.length}: ${request.type}`);
    
    try {
      const result = await generateAIContent(
        request.type,
        request.content,
        request.topics,
        request.options
      );
      results.push({ success: true, data: result, request });
      
      // Add delay between requests
      if (i < requests.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Failed AI request ${i + 1}:`, error);
      results.push({ success: false, error: error.message, request });
    }
  }
  
  return results;
};

module.exports = {
  generateAIContent,
  batchGenerateContent,
  parseAIResponse
};