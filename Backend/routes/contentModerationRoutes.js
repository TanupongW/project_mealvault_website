const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/authMiddleware');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Load profanity words from dataset files
// Returns: { level1: [], level2: [] }
// Level 1: Clear profanity (block immediately)
// Level 2: Sensitive/negative words (AI context check needed)
function loadProfanityWords() {
  const level1Words = new Set(); // Clear profanity - block immediately
  const level2Words = new Set(); // Sensitive words - AI context check
  
  try {
    // ===== LEVEL 1: Clear Profanity (Block Immediately) =====
    
    // Load swear words from thaiBadword/swear-words.txt
    const swearWordsPath = path.join(__dirname, '../data/thaiBadword/swear-words.txt');
    if (fs.existsSync(swearWordsPath)) {
      const swearWords = fs.readFileSync(swearWordsPath, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      
      swearWords.forEach(word => level1Words.add(word.toLowerCase()));
      console.log(`[Level 1] Loaded ${swearWords.length} swear words from dataset`);
    }

    // Load toxic keywords from ThaiToxicityTweetCorpus/toxic_keywords.txt
    const toxicKeywordsPath = path.join(__dirname, '../data/ThaiToxicityTweetCorpus-master/ThaiToxicityTweetCorpus-master/toxic_keywords.txt');
    if (fs.existsSync(toxicKeywordsPath)) {
      const toxicKeywords = fs.readFileSync(toxicKeywordsPath, 'utf-8')
        .split('\n')
        .map(line => {
          // Parse format: "word\ttranslation" - take only the word part
          const word = line.split('\t')[0]?.trim();
          return word;
        })
        .filter(word => word && !word.startsWith('#'));
      
      toxicKeywords.forEach(word => level1Words.add(word.toLowerCase()));
      console.log(`[Level 1] Loaded ${toxicKeywords.length} toxic keywords from dataset`);
    }

    // High-priority negative sentiment words that are clearly profanity
    const highPriorityNegativeWords = [
      'เหี้ย', 'สัด', 'หมา', 'ควาย', 'ชาติชั่ว', 'ระยำ', 'แม่ง', 'สาส', 'สัส', 
      'ควย', 'ห่า', 'เชี่ย', 'พ่อง', 'มึง', 'กู', 'อี', 'ไอ้'
    ];
    highPriorityNegativeWords.forEach(word => level1Words.add(word.toLowerCase()));

    // English profanity
    const englishProfanity = [
      'fuck', 'shit', 'damn', 'hell', 'bitch', 'ass', 'bastard', 'dick',
      'cunt', 'piss', 'cock', 'whore', 'slut'
    ];
    englishProfanity.forEach(word => level1Words.add(word.toLowerCase()));

    // ===== LEVEL 2: Sensitive/Negative Words (AI Context Check) =====
    
    // Load negative sentiment words (words that might be used to evade detection)
    const negativeSentimentPath = path.join(__dirname, '../data/thaiBadword/negative-sentiment-words.txt');
    if (fs.existsSync(negativeSentimentPath)) {
      const negativeWords = fs.readFileSync(negativeSentimentPath, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.length > 0);
      
      negativeWords.forEach(word => {
        const lowerWord = word.toLowerCase();
        // Only add to level2 if not already in level1 (avoid duplicates)
        if (!level1Words.has(lowerWord)) {
          level2Words.add(lowerWord);
        }
      });
      console.log(`[Level 2] Loaded ${negativeWords.length} negative sentiment words from dataset`);
    }

    console.log(`[Level 1] Total clear profanity words: ${level1Words.size}`);
    console.log(`[Level 2] Total sensitive words: ${level2Words.size}`);
    
    return {
      level1: Array.from(level1Words),
      level2: Array.from(level2Words)
    };
  } catch (error) {
    console.error('Error loading profanity words from datasets:', error);
    // Fallback to basic list if files can't be loaded
    const fallbackLevel1 = [
      'สัตว์', 'สัตว', 'ไอ้', 'อี', 'ควาย', 'หมา', 'เหี้ย', 'แม่ง', 'สาส', 'สัส', 'ควย',
      'ชาติชั่ว', 'ระยำ', 'มึง', 'กู', 'ห่า', 'เชี่ย', 'พ่อง',
      'fuck', 'shit', 'damn', 'hell', 'bitch', 'ass', 'bastard', 'dick'
    ];
    return {
      level1: fallbackLevel1,
      level2: []
    };
  }
}

// Load profanity words at startup
const PROFANITY_DATASETS = loadProfanityWords();
const PROFANITY_WORDS = [...PROFANITY_DATASETS.level1, ...PROFANITY_DATASETS.level2]; // Combined for backward compatibility

// Check content for profanity using dataset words (2-level system)
async function checkProfanity(text) {
  const lowerText = text.toLowerCase();
  const detectedLevel1 = []; // Clear profanity - block immediately
  const detectedLevel2 = []; // Sensitive words - AI context check
  
  // Check for common Thai profanity patterns first (Level 1)
  const profanityPatterns = [
    { pattern: /ไอ[^\s\.,!?;:]*เอ้ย/g, name: 'ไอ...เอ้ย', level: 1 },  // Pattern: "ไอ...เอ้ย" (e.g., "ไอมืดเอ้ย")
    { pattern: /ไอ[^\s\.,!?;:]*เหี้ย/g, name: 'ไอ...เหี้ย', level: 1 },
    { pattern: /อี[^\s\.,!?;:]*เหี้ย/g, name: 'อี...เหี้ย', level: 1 },
    { pattern: /มืดเอ้ย/g, name: 'มืดเอ้ย', level: 1 },
    { pattern: /ไอมืด/g, name: 'ไอมืด', level: 1 },
    { pattern: /เอ้ย/g, name: 'เอ้ย', level: 1, conditional: true },  // Only if used with profanity
  ];
  
  for (const { pattern, name, level, conditional } of profanityPatterns) {
    const matches = lowerText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Filter out false positives (e.g., "เอ้ย" alone might match legitimate words)
        if (conditional && name === 'เอ้ย') {
          // Only match "เอ้ย" if it appears with profanity indicators
          if (lowerText.match(/ไอ.*เอ้ย|ห่า.*เอ้ย|เหี้ย.*เอ้ย/)) {
            if (!detectedLevel1.includes(match)) {
              detectedLevel1.push(match);
            }
          }
        } else {
          if (level === 1 && !detectedLevel1.includes(match)) {
            detectedLevel1.push(match);
          }
        }
      });
    }
  }
  
  // Check Level 1 words (clear profanity)
  const sortedLevel1 = [...PROFANITY_DATASETS.level1].sort((a, b) => b.length - a.length);
  
  for (const word of sortedLevel1) {
    const lowerWord = word.toLowerCase();
    const escapedWord = lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const wordWithBoundaries = new RegExp(
      `(^|[\\s\\u200B\\u200C\\u200D\\uFEFF.,!?;:])${escapedWord}([\\s\\u200B\\u200C\\u200D\\uFEFF.,!?;:]|$)`,
      'i'
    );
    
    const exactMatch = lowerText === lowerWord;
    const appearsInText = lowerText.includes(lowerWord);
    
    if (wordWithBoundaries.test(lowerText) || exactMatch || appearsInText) {
      if (!detectedLevel1.includes(word)) {
        detectedLevel1.push(word);
      }
    }
  }
  
  // Check Level 2 words (sensitive/negative - need AI context check)
  const sortedLevel2 = [...PROFANITY_DATASETS.level2].sort((a, b) => b.length - a.length);
  
  for (const word of sortedLevel2) {
    const lowerWord = word.toLowerCase();
    const escapedWord = lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const wordWithBoundaries = new RegExp(
      `(^|[\\s\\u200B\\u200C\\u200D\\uFEFF.,!?;:])${escapedWord}([\\s\\u200B\\u200C\\u200D\\uFEFF.,!?;:]|$)`,
      'i'
    );
    
    const exactMatch = lowerText === lowerWord;
    const appearsInText = lowerText.includes(lowerWord);
    
    if (wordWithBoundaries.test(lowerText) || exactMatch || appearsInText) {
      if (!detectedLevel2.includes(word)) {
        detectedLevel2.push(word);
      }
    }
  }

  // Determine severity based on detected words
  const allDetected = [...detectedLevel1, ...detectedLevel2];
  
  let severity = 'none';
  if (detectedLevel1.length > 0) {
    // Level 1 words found - block immediately
    severity = detectedLevel1.length >= 3 ? 'critical' : 'high';
  } else if (detectedLevel2.length > 0) {
    // Only Level 2 words found - lower severity, let AI decide
    severity = detectedLevel2.length >= 3 ? 'medium' : 'low';
  }

  return {
    hasProfanity: allDetected.length > 0,
    detectedWords: allDetected,
    detectedLevel1: detectedLevel1, // Clear profanity
    detectedLevel2: detectedLevel2, // Sensitive words
    severity
  };
}

// AI-powered content moderation with dataset pre-check
async function checkContentWithAI(content, contentType) {
  try {
    // Step 1: Pre-check with dataset (fast and free)
    const datasetCheck = await checkProfanity(content);
    
    // Step 2: If no GEMINI_API_KEY, return dataset check result
    if (!process.env.GEMINI_API_KEY) {
      return datasetCheck;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Include dataset findings in the prompt for AI context
    let datasetInfo = '';
    if (datasetCheck.hasProfanity) {
      const level1Words = datasetCheck.detectedLevel1 || [];
      const level2Words = datasetCheck.detectedLevel2 || [];
      
      if (level1Words.length > 0) {
        datasetInfo += `\n\n[CRITICAL] Pre-check detected clear profanity words: ${level1Words.join(', ')}. These should be blocked.`;
      }
      if (level2Words.length > 0) {
        datasetInfo += `\n\n[REVIEW] Pre-check detected sensitive/negative words: ${level2Words.join(', ')}. Please check context - these might be used legitimately or as evasion techniques.`;
      }
    } else {
      datasetInfo = '\n\nNote: Pre-check with Thai profanity dataset found no obvious profanity or sensitive words.';
    }

    const prompt = `
      Analyze the following ${contentType} content for:
      1. Profanity or inappropriate language (Thai and English)
      2. Hate speech or discrimination
      3. Spam or promotional content
      4. Threats or harmful content
      5. Evasion techniques (words used to bypass filters)
      
      Content: "${content}"
      ${datasetInfo}
      
      Respond in JSON format:
      {
        "hasProfanity": boolean,
        "hasHateSpeech": boolean,
        "isSpam": boolean,
        "hasThreat": boolean,
        "detectedIssues": ["list of specific issues found"],
        "severity": "none|low|medium|high|critical",
        "reason": "Brief explanation"
      }
      
      Important guidelines:
      - If [CRITICAL] words are found, they are clear profanity - BLOCK immediately
      - If [REVIEW] sensitive words are found, check context carefully:
        * Are they used in a negative/insulting way? → Mark as inappropriate
        * Are they used legitimately (e.g., "มืด" in "มันมืดแล้ว")? → Allow
        * Are they part of evasion attempts (e.g., "ไอมืดเอ้ย")? → BLOCK
      - Be strict but fair. Consider cultural context for Thai content.
      - Pay attention to word combinations that might be used to evade detection.
      Return ONLY JSON.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        // Combine dataset findings with AI analysis
        const combinedDetectedWords = [
          ...datasetCheck.detectedWords,
          ...(analysis.detectedIssues || [])
        ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
        
        // Use more severe severity between dataset and AI
        const severityMap = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
        const datasetSeverityLevel = severityMap[datasetCheck.severity] || 0;
        const aiSeverityLevel = severityMap[analysis.severity] || 0;
        const finalSeverity = datasetSeverityLevel >= aiSeverityLevel 
          ? datasetCheck.severity 
          : analysis.severity;
        
        return {
          hasProfanity: analysis.hasProfanity || datasetCheck.hasProfanity,
          detectedWords: combinedDetectedWords,
          severity: finalSeverity,
          aiAnalysis: analysis,
          datasetCheck: {
            hasProfanity: datasetCheck.hasProfanity,
            detectedWords: datasetCheck.detectedWords,
            detectedLevel1: datasetCheck.detectedLevel1 || [],
            detectedLevel2: datasetCheck.detectedLevel2 || [],
            severity: datasetCheck.severity
          },
          detectedLevel1: datasetCheck.detectedLevel1 || [],
          detectedLevel2: datasetCheck.detectedLevel2 || []
        };
      }
    } catch (parseError) {
      console.error('Error parsing AI moderation response:', parseError);
      // If AI parsing fails, return dataset check result
      return datasetCheck;
    }
  } catch (error) {
    console.error('Error with AI moderation:', error);
    // If AI error, return dataset check result
    return checkProfanity(content);
  }

  // Fallback to dataset check
  return checkProfanity(content);
}

// Check recipe for plagiarism
async function checkRecipePlagiarism(recipeData) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      // Simple similarity check without AI
      return await simpleRecipeSimilarityCheck(recipeData);
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Get existing recipes for comparison (จาก UserRecipe)
    const { data: existingRecipes } = await supabase
      .from('UserRecipe')
      .select(`
        recipe_id,
        recipe_title,
        recipe_summary,
        ingredients,
        steps
      `)
      .limit(50); // Compare with recent recipes

    // Parse recipe data
    const parsedRecipes = (existingRecipes || []).map(r => {
      return {
        recipe_id: r.recipe_id,
        recipe_title: r.recipe_title,
        recipe_summary: r.recipe_summary || null,
        ingredients: r.ingredients || [],
        steps: r.steps || []
      };
    });

    const prompt = `
      Check if the new recipe is plagiarized from existing recipes.
      
      New Recipe:
      Title: ${recipeData.title}
      Summary: ${recipeData.summary || 'None'}
      Ingredients: ${JSON.stringify(recipeData.ingredients)}
      Steps: ${JSON.stringify(recipeData.steps)}
      
      Existing Recipes to compare:
      ${parsedRecipes.map(r => `
        Title: ${r.recipe_title}
        Summary: ${r.recipe_summary || 'None'}
        Ingredients: ${JSON.stringify(r.ingredients)}
        Steps: ${JSON.stringify(r.steps)}
      `).join('\n---\n')}
      
      Analyze for:
      1. Exact or near-exact copying of recipe steps
      2. Same ingredients in same proportions
      3. Paraphrased but essentially identical instructions
      4. Consider that similar traditional recipes may have legitimate similarities
      
      Respond in JSON:
      {
        "isPlagiarized": boolean,
        "similarityScore": 0.0-1.0,
        "mostSimilarRecipeId": "recipe_id or null",
        "similarities": ["list of specific similarities found"],
        "reason": "Explanation of findings"
      }
      
      Be fair - traditional recipes often share similarities.
      Return ONLY JSON.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing plagiarism check:', parseError);
    }
  } catch (error) {
    console.error('Error checking plagiarism:', error);
  }

  // Fallback
  return await simpleRecipeSimilarityCheck(recipeData);
}

// Simple recipe similarity check (fallback)
async function simpleRecipeSimilarityCheck(recipeData) {
  try {
    // ดึงข้อมูลจาก UserRecipe
    const { data: existingRecipes } = await supabase
      .from('UserRecipe')
      .select(`
        recipe_id,
        ingredients,
        steps
      `)
      .limit(100);

    // Parse recipe data
    const parsedRecipes = (existingRecipes || []).map(r => {
      return {
        recipe_id: r.recipe_id,
        ingredients: r.ingredients || [],
        steps: r.steps || []
      };
    });

    let highestSimilarity = 0;
    let mostSimilarId = null;

    for (const existing of parsedRecipes) {
      // Compare ingredients
      const newIngredients = JSON.stringify(recipeData.ingredients || []).toLowerCase();
      const existingIngredients = JSON.stringify(existing.ingredients || []).toLowerCase();
      
      // Simple similarity: check overlap
      const ingredientSimilarity = calculateStringSimilarity(newIngredients, existingIngredients);
      
      // Compare steps
      const newSteps = JSON.stringify(recipeData.steps || []).toLowerCase();
      const existingSteps = JSON.stringify(existing.steps || []).toLowerCase();
      const stepsSimilarity = calculateStringSimilarity(newSteps, existingSteps);
      
      const overallSimilarity = (ingredientSimilarity + stepsSimilarity) / 2;
      
      if (overallSimilarity > highestSimilarity) {
        highestSimilarity = overallSimilarity;
        mostSimilarId = existing.recipe_id;
      }
    }

    return {
      isPlagiarized: highestSimilarity > 0.8, // 80% similarity threshold
      similarityScore: highestSimilarity,
      mostSimilarRecipeId: highestSimilarity > 0.5 ? mostSimilarId : null,
      similarities: highestSimilarity > 0.5 ? ['High content similarity detected'] : [],
      reason: highestSimilarity > 0.8 ? 'Recipe appears to be very similar to existing content' : 'Recipe appears original'
    };
  } catch (error) {
    console.error('Error in similarity check:', error);
    return {
      isPlagiarized: false,
      similarityScore: 0,
      error: true
    };
  }
}

// Basic string similarity calculation
function calculateStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Levenshtein distance
function getEditDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Middleware to check content before saving
async function moderateContent(req, res, next) {
  try {
    let contentToCheck = '';
    let contentType = 'post';

    // Determine what content to check based on the route
    if (req.body.cpost_title || req.body.cpost_content) {
      contentToCheck = `${req.body.cpost_title || ''} ${req.body.cpost_content || ''}`;
      contentType = 'post';
    } else if (req.body.comment_content) {
      contentToCheck = req.body.comment_content;
      contentType = 'comment';
    } else if (req.body.recipe_title || req.body.recipe_summary) {
      contentToCheck = `${req.body.recipe_title || ''} ${req.body.recipe_summary || ''}`;
      contentType = 'recipe';
    }

    if (contentToCheck) {
      const moderation = await checkContentWithAI(contentToCheck, contentType);
      
      // Only block if:
      // 1. Level 1 words detected (clear profanity) - BLOCK immediately
      // 2. OR severity is high/critical (from AI or dataset)
      const hasLevel1Words = moderation.datasetCheck?.detectedLevel1?.length > 0 || 
                             (moderation.detectedLevel1 && moderation.detectedLevel1.length > 0);
      const hasHighSeverity = moderation.severity === 'high' || moderation.severity === 'critical';
      
      if (hasLevel1Words || hasHighSeverity) {
        // Block the content - clear profanity detected
        return res.status(400).json({
          message: 'ข้อความของคุณมีเนื้อหาที่ไม่เหมาะสม กรุณาแก้ไขก่อนโพสต์',
          moderation: {
            reason: moderation.aiAnalysis?.reason || 'Inappropriate content detected',
            severity: moderation.severity,
            detectedWords: moderation.detectedWords
          }
        });
      }
      
      // For Level 2 words (sensitive/negative words) - let AI decide based on context
      const hasOnlyLevel2Words = (moderation.datasetCheck?.detectedLevel2?.length > 0 || 
                                   (moderation.detectedLevel2 && moderation.detectedLevel2.length > 0)) &&
                                  !hasLevel1Words;
      
      if (hasOnlyLevel2Words) {
        // Only Level 2 words detected - check AI's decision
        // Block only if AI explicitly says it's profanity AND severity is medium or higher
        if (moderation.aiAnalysis && 
            moderation.aiAnalysis.hasProfanity === true && 
            (moderation.severity === 'medium' || moderation.severity === 'high')) {
          // AI says it's inappropriate with medium+ severity - block it
          return res.status(400).json({
            message: 'ข้อความของคุณมีเนื้อหาที่ไม่เหมาะสม กรุณาแก้ไขก่อนโพสต์',
            moderation: {
              reason: moderation.aiAnalysis?.reason || 'Inappropriate content detected',
              severity: moderation.severity,
              detectedWords: moderation.detectedWords
            }
          });
        }
        
        // Otherwise allow it (low severity or AI says it's OK)
        // Examples: "แย่มากอันนี้", "อากาศมืดแล้ว" - legitimate uses
        // These will pass through
      }

      // Store moderation result for logging
      req.moderation = moderation;
    }

    next();
  } catch (error) {
    console.error('Error in content moderation middleware:', error);
    // Don't block on error, just continue
    next();
  }
}

// Routes

// Check content for moderation issues
router.post('/moderation/check', authMiddleware, async (req, res) => {
  const { content, contentType = 'post' } = req.body;

  if (!content) {
    return res.status(400).json({ message: 'Content is required' });
  }

  try {
    const moderation = await checkContentWithAI(content, contentType);
    res.json({
      isAppropriate: moderation.severity === 'none' || moderation.severity === 'low',
      moderation
    });
  } catch (error) {
    console.error('Error checking content:', error);
    res.status(500).json({ message: 'Failed to check content' });
  }
});

// Check recipe for plagiarism
router.post('/plagiarism/check-recipe', authMiddleware, async (req, res) => {
  const { title, summary, ingredients, steps } = req.body;

  if (!title || !ingredients || !steps) {
    return res.status(400).json({ message: 'Title, ingredients, and steps are required' });
  }

  try {
    const plagiarismCheck = await checkRecipePlagiarism({
      title,
      summary,
      ingredients,
      steps
    });

    // If plagiarism detected, save to database
    if (plagiarismCheck.isPlagiarized && plagiarismCheck.mostSimilarRecipeId) {
      await supabase
        .from('ContentDuplicateDetection')
        .insert([{
          source_type: 'recipe',
          source_id: 'pending_' + Date.now(), // Temporary ID for new recipe
          duplicate_id: plagiarismCheck.mostSimilarRecipeId,
          similarity_score: plagiarismCheck.similarityScore
        }]);
    }

    res.json({
      isOriginal: !plagiarismCheck.isPlagiarized,
      plagiarismCheck
    });
  } catch (error) {
    console.error('Error checking plagiarism:', error);
    res.status(500).json({ message: 'Failed to check plagiarism' });
  }
});

// Report content manually
router.post('/report/content', authMiddleware, async (req, res) => {
  const { contentType, contentId, reason, details } = req.body;
  const user_id = req.user.id;

  if (!contentType || !contentId || !reason) {
    return res.status(400).json({ message: 'contentType, contentId, and reason are required' });
  }

  try {
    // Check content with AI for additional context
    let contentText = '';
    if (contentType === 'post') {
      const { data: post } = await supabase
        .from('CommunityPost')
        .select('cpost_title, cpost_content')
        .eq('cpost_id', contentId)
        .single();
      contentText = `${post?.cpost_title || ''} ${post?.cpost_content || ''}`;
    } else if (contentType === 'comment') {
      const { data: comment } = await supabase
        .from('CommunityComment')
        .select('comment_text')
        .eq('comment_id', contentId)
        .single();
      contentText = comment?.comment_text || '';
    }

    const moderation = await checkContentWithAI(contentText, contentType);

    // Save to content moderation table
    await supabase
      .from('ContentModeration')
      .insert([{
        content_type: contentType,
        content_id: contentId,
        moderation_reason: reason,
        detected_words: moderation.detectedWords || [],
        severity: moderation.severity || 'medium',
        is_auto_hidden: moderation.severity === 'critical'
      }]);

    // Also create a report
    const reportId = 'REP' + Date.now();
    await supabase
      .from('CommunityReport')
      .insert([{
        creport_id: reportId,
        creport_type: reason,
        creport_reason: reason,
        creport_details: details,
        cpost_id: contentType === 'post' ? contentId : null,
        comment_id: contentType === 'comment' ? contentId : null,
        user_id
      }]);

    res.json({ 
      message: 'รายงานของคุณถูกส่งเรียบร้อยแล้ว',
      reportId,
      aiAssessment: moderation
    });
  } catch (error) {
    console.error('Error reporting content:', error);
    res.status(500).json({ message: 'Failed to report content' });
  }
});

// Get moderation reports (admin only)
router.get('/moderation/reports', authMiddleware, async (req, res) => {
  const user_id = req.user.id;

  try {
    // Check if user is admin
    const { data: admin } = await supabase
      .from('Admin')
      .select('admin_id')
      .eq('admin_id', user_id)
      .single();

    if (!admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Get pending moderation reports
    const { data: reports } = await supabase
      .from('ContentModeration')
      .select(`
        *,
        CommunityPost (cpost_title, user_id),
        CommunityComment (comment_text, user_id)
      `)
      .eq('reviewed', false)
      .order('detection_date', { ascending: false });

    res.json(reports);
  } catch (error) {
    console.error('Error fetching moderation reports:', error);
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
});

// Review moderation report (admin only)
router.post('/moderation/review', authMiddleware, async (req, res) => {
  const { moderationId, action } = req.body;
  const user_id = req.user.id;

  try {
    // Check if user is admin
    const { data: admin } = await supabase
      .from('Admin')
      .select('admin_id')
      .eq('admin_id', user_id)
      .single();

    if (!admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Update moderation record
    const { error } = await supabase
      .from('ContentModeration')
      .update({
        reviewed: true,
        reviewed_by: user_id,
        review_date: new Date().toISOString(),
        review_action: action
      })
      .eq('id', moderationId);

    if (error) throw error;

    // If rejected, hide the content
    if (action === 'rejected') {
      const { data: moderation } = await supabase
        .from('ContentModeration')
        .select('content_type, content_id')
        .eq('id', moderationId)
        .single();

      if (moderation?.content_type === 'post') {
        await supabase
          .from('CommunityPost')
          .delete()
          .eq('cpost_id', moderation.content_id);
      } else if (moderation?.content_type === 'comment') {
        await supabase
          .from('CommunityComment')
          .delete()
          .eq('comment_id', moderation.content_id);
      }
    }

    res.json({ message: 'Review completed successfully' });
  } catch (error) {
    console.error('Error reviewing moderation:', error);
    res.status(500).json({ message: 'Failed to review moderation' });
  }
});

module.exports = router;
module.exports.moderateContent = moderateContent;
