const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/authMiddleware');
// ไม่ใช้ Gemini AI แล้ว ใช้แค่ ML recommendations
// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Get AI-powered recommendations based on user behavior
router.get('/ai/recommendations', authMiddleware, async (req, res) => {
  const user_id = req.user.id;

  try {
    // Fetch user behavior data
    const behaviorData = await getUserBehaviorData(user_id);
    
    // Get user profile preferences
    const { data: userProfile } = await supabase
      .from('User')
      .select('allergies, favorite_foods, calorie_limit')
      .eq('user_id', user_id)
      .single();

    // ใช้ ML-based recommendations เป็นหลัก (Content-Based Filtering)
    // ML ใช้ database โดยตรง ไม่มีปัญหา menu_id ไม่ตรง และทำงานได้เสมอ
    console.log('🔍 [Backend] Generating ML recommendations...');
    console.log('🔍 [Backend] Behavior data summary:', {
      viewedMenus: behaviorData.viewedMenus?.length || 0,
      likedMenus: behaviorData.likedMenus?.length || 0,
      ingredientPrefs: behaviorData.ingredientPrefs?.length || 0,
      categoryPrefs: behaviorData.categoryPrefs?.length || 0
    });
    
    const mlRecommendations = await getMLRecommendations(behaviorData, userProfile);
    console.log('🔍 [Backend] ML recommendations count:', mlRecommendations.recommendations?.length || 0);
    console.log('🔍 [Backend] ML method:', mlRecommendations.method);
    
    // ถ้า ML ให้ผลมา (แม้จะน้อย) ก็ใช้เลย
    if (mlRecommendations.recommendations && mlRecommendations.recommendations.length > 0) {
      console.log('✅ [Backend] Using ML recommendations');
      return res.json(mlRecommendations);
    }

    // Fallback to rule-based ถ้า ML ไม่ได้ผล
    console.log('⚠️ [Backend] ML returned empty, using rule-based fallback...');
    const ruleBased = await getRuleBasedRecommendations(behaviorData, userProfile);
    console.log('✅ [Backend] Using rule-based recommendations, count:', ruleBased.recommendations?.length || 0);
    res.json(ruleBased);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ message: 'Failed to generate recommendations' });
  }
});

async function getUserBehaviorData(user_id) {
  try {
    // Get viewed menus
    const { data: viewedMenus } = await supabase
      .from('UserMenuView')
      .select(`
        menu_id,
        view_count,
        last_viewed_at,
        Menu (menu_name, menu_description, category_id)
      `)
      .eq('user_id', user_id)
      .order('view_count', { ascending: false })
      .limit(20);

    // Get liked menus
    const { data: likedMenus } = await supabase
      .from('MenuLike')
      .select(`
        menu_id,
        Menu (menu_name, menu_description, category_id)
      `)
      .eq('user_id', user_id)
      .limit(20);

    // Get ingredient preferences
    const { data: ingredientPrefs } = await supabase
      .from('UserIngredientPreference')
      .select('ingredient_name, preference_score')
      .eq('user_id', user_id)
      .order('preference_score', { ascending: false });

    // Get category preferences
    const { data: categoryPrefs } = await supabase
      .from('UserCategoryPreference')
      .select(`
        category_id,
        preference_score,
        Category (category_name)
      `)
      .eq('user_id', user_id)
      .order('preference_score', { ascending: false });

    // Get recent searches
    const { data: recentSearches } = await supabase
      .from('UserSearchHistory')
      .select('search_query, search_type')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get meal plan history
    const { data: mealPlanHistory } = await supabase
      .from('WeeklyMealPlan')
      .select(`
        menu_id,
        Menu (menu_name, menu_description)
      `)
      .eq('user_id', user_id)
      .limit(30);

    return {
      viewedMenus,
      likedMenus,
      ingredientPrefs,
      categoryPrefs,
      recentSearches,
      mealPlanHistory
    };
  } catch (error) {
    console.error('Error fetching behavior data:', error);
    return {};
  }
}

async function generateAIRecommendations(behaviorData, userProfile) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      // Fallback to rule-based recommendations if no AI key
      return await getRuleBasedRecommendations(behaviorData, userProfile);
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Prepare context for AI
    const likedIngredients = (behaviorData.ingredientPrefs || [])
      .filter(p => p.preference_score > 0)
      .slice(0, 10)
      .map(p => p.ingredient_name);

    const dislikedIngredients = (behaviorData.ingredientPrefs || [])
      .filter(p => p.preference_score < 0)
      .slice(0, 10)
      .map(p => p.ingredient_name);

    const preferredCategories = (behaviorData.categoryPrefs || [])
      .slice(0, 5)
      .map(p => p.Category?.category_name)
      .filter(Boolean);

    const recentSearchTerms = (behaviorData.recentSearches || [])
      .map(s => s.search_query)
      .slice(0, 5);

    // Candidate menus must come from database only (AI will only rank/choose, not invent)
    // เพิ่ม limit และเรียงตาม popularity เพื่อให้ AI มีตัวเลือกที่ดี
    const { data: candidateMenus } = await supabase
      .from('Menu')
      .select('menu_id, menu_name, menu_image, menu_description, menu_recipe, category_id, menu_like_count')
      .order('menu_like_count', { ascending: false, nullsFirst: false })
      .limit(150); // เพิ่มเป็น 150 เพื่อให้มีตัวเลือกมากขึ้น

    if (!candidateMenus || candidateMenus.length === 0) {
      return await getRuleBasedRecommendations(behaviorData, userProfile);
    }

    const candidateJson = JSON.stringify(candidateMenus);

    const prompt = `
      You are a Thai food recommendation system.
      Your task is to choose up to 10 menu items from the provided database menus that best fit this specific user.

      User Profile:
      - Allergies: ${userProfile?.allergies || 'None'}
      - Favorite Foods: ${userProfile?.favorite_foods || 'Not specified'}
      - Calorie Limit: ${userProfile?.calorie_limit || 'Not specified'}

      User Behavior Summary:
      - Frequently viewed/liked ingredients: ${likedIngredients.join(', ') || 'None'}
      - Avoided ingredients: ${dislikedIngredients.join(', ') || 'None'}
      - Preferred categories: ${preferredCategories.join(', ') || 'None'}
      - Recent searches: ${recentSearchTerms.join(', ') || 'None'}

      Database Menus (JSON):
      ${candidateJson}

      **CRITICAL RULES - YOU MUST FOLLOW THESE:**
      1. You MUST ONLY choose menus from the "Database Menus (JSON)" list above. 
      2. You MUST use the EXACT "menu_id" from the database for each menu you recommend.
      3. DO NOT create, invent, or suggest any menu names that are NOT in the database list.
      4. If a menu name you want to suggest is not in the database, you MUST skip it and choose another one from the list.
      5. Return exactly 10 menus when possible, using ONLY menu_id values that exist in the database JSON above.
      6. **IMPORTANT**: Do NOT only recommend menus the user has already liked. Instead, recommend NEW menus that are similar to their preferences (same categories, similar ingredients) but they haven't tried yet. Mix some liked menus with many new similar menus.
      7. Consider user allergies (avoid them), positive/negative ingredient preferences, preferred categories, and searches.
      8. Prioritize variety: choose menus from different categories when possible.

      **Your response MUST be a JSON array with menu_id values that EXACTLY match the menu_id values in the database JSON above.**

      Format your response as a JSON array with this structure:
      [
        {
          "menu_id": "ID from database",
          "reason": "Brief explanation why this menu matches user preferences",
          "matching_preferences": ["ingredient1", "category1"],
          "estimated_calories": number
        }
      ]

      Return ONLY the JSON array, no other text.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse AI response
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const aiRecs = JSON.parse(jsonMatch[0]);

        // Combine AI recommendations with actual menu data from database
        console.log('🔍 [Backend] AI returned', aiRecs?.length || 0, 'recommendations');
        let enrichedRecommendations = (aiRecs || [])
          .filter(rec => {
            const hasMenuId = rec && rec.menu_id;
            if (!hasMenuId) {
              console.warn('⚠️ [Backend] AI recommendation without menu_id:', rec);
            }
            return hasMenuId;
          })
          .map(rec => {
            const menu = candidateMenus.find(m => m.menu_id === rec.menu_id);
            if (!menu) {
              console.warn('⚠️ [Backend] AI menu_id not found in database:', rec.menu_id);
            }
            return {
              menu_id: menu?.menu_id,
              menu_name: menu?.menu_name,
              menu_image: menu?.menu_image,
              menu_description: menu?.menu_description,
              reason: rec.reason || 'Based on your preferences',
              matching_preferences: Array.isArray(rec.matching_preferences) ? rec.matching_preferences : [],
              estimated_calories: rec.estimated_calories || null,
              exists_in_db: !!menu
            };
          })
          .filter(item => {
            const hasMenuId = item.menu_id;
            if (!hasMenuId) {
              console.warn('⚠️ [Backend] Filtered out item without menu_id:', item);
            }
            return hasMenuId;
          });
        
        console.log('🔍 [Backend] After enrichment:', enrichedRecommendations.length, 'valid recommendations');

        // ถ้า AI ให้เมนูน้อยกว่า 10 ให้เติมจาก rule-based ให้ครบ (ไม่ซ้ำ menu_id)
        if (enrichedRecommendations.length < 10) {
          const fallback = await getRuleBasedRecommendations(behaviorData, userProfile);
          const existingIds = new Set(enrichedRecommendations.map(r => r.menu_id));
          const extra = (fallback.recommendations || []).filter(
            r => r.menu_id && !existingIds.has(r.menu_id)
          );
          const needed = 10 - enrichedRecommendations.length;
          if (needed > 0 && extra.length > 0) {
            enrichedRecommendations = [
              ...enrichedRecommendations,
              ...extra.slice(0, needed),
            ];
          }
        }

        return {
          recommendations: enrichedRecommendations,
          method: 'ai_behavior_based'
        };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
    }

    // Fallback if AI fails
    return await getRuleBasedRecommendations(behaviorData, userProfile);
  } catch (error) {
    console.error('Error with AI recommendations:', error);
    return await getRuleBasedRecommendations(behaviorData, userProfile);
  }
}

// ==================== ML-Based Recommendation System ====================
// Content-Based Filtering using Cosine Similarity

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extract ingredients from menu text
 */
function extractIngredients(menuText, commonIngredients) {
  const found = [];
  const lowerText = menuText.toLowerCase();
  
  for (const ing of commonIngredients) {
    if (lowerText.includes(ing.toLowerCase())) {
      found.push(ing);
    }
  }
  
  return found;
}

/**
 * Build feature vector for a menu
 */
function buildMenuVector(menu, allIngredients, allCategories) {
  const vector = [];
  
  // Extract ingredients from menu
  const menuText = `${menu.menu_recipe || ''} ${menu.menu_description || ''}`;
  const menuIngredients = extractIngredients(menuText, allIngredients);
  
  // Feature 1-50: Ingredient presence (binary: 0 or 1)
  for (const ing of allIngredients) {
    vector.push(menuIngredients.includes(ing) ? 1 : 0);
  }
  
  // Feature 51-60: Category one-hot encoding
  for (const cat of allCategories) {
    vector.push(menu.category_id === cat ? 1 : 0);
  }
  
  // Feature 61: Popularity score (normalized like count)
  const normalizedPopularity = Math.min((menu.menu_like_count || 0) / 100, 1);
  vector.push(normalizedPopularity);
  
  return vector;
}

/**
 * Build user profile vector from behavior data
 */
function buildUserProfileVector(behaviorData, allIngredients, allCategories) {
  const vector = [];
  
  // Create ingredient preference map
  const ingredientPrefMap = new Map();
  (behaviorData.ingredientPrefs || []).forEach(pref => {
    ingredientPrefMap.set(pref.ingredient_name, pref.preference_score);
  });
  
  // Feature 1-50: Ingredient preference scores (normalized to 0-1)
  for (const ing of allIngredients) {
    const score = ingredientPrefMap.get(ing) || 0;
    // Normalize: -10 to 10 -> 0 to 1
    const normalized = (score + 10) / 20;
    vector.push(Math.max(0, Math.min(1, normalized)));
  }
  
  // Feature 51-60: Category preference scores
  const categoryPrefMap = new Map();
  (behaviorData.categoryPrefs || []).forEach(pref => {
    categoryPrefMap.set(pref.category_id, pref.preference_score);
  });
  
  for (const cat of allCategories) {
    const score = categoryPrefMap.get(cat) || 0;
    const normalized = (score + 10) / 20;
    vector.push(Math.max(0, Math.min(1, normalized)));
  }
  
  // Feature 61: User engagement score (based on views, likes, meal plans)
  const viewCount = (behaviorData.viewedMenus || []).length;
  const likeCount = (behaviorData.likedMenus || []).length;
  const mealPlanCount = (behaviorData.mealPlanHistory || []).length;
  const engagementScore = Math.min((viewCount + likeCount * 2 + mealPlanCount * 3) / 50, 1);
  vector.push(engagementScore);
  
  return vector;
}

/**
 * ML-Based Recommendations using Content-Based Filtering
 */
async function getMLRecommendations(behaviorData, userProfile) {
  try {
    console.log('🔍 [ML] Starting ML recommendations...');
    // Get all menus from database
    const { data: allMenus } = await supabase
      .from('Menu')
      .select('menu_id, menu_name, menu_image, menu_description, menu_recipe, category_id, menu_like_count');
    
    console.log('🔍 [ML] Total menus in database:', allMenus?.length || 0);
    
    if (!allMenus || allMenus.length === 0) {
      console.warn('⚠️ [ML] No menus found in database');
      return { recommendations: [], method: 'ml_content_based' };
    }
    
    // Common Thai ingredients (same as in behaviorRoutes.js)
    const commonIngredients = [
      'หมู', 'ไก่', 'เนื้อ', 'ปลา', 'กุ้ง', 'หอย', 'ปู', 'ไข่',
      'ผัก', 'ผักกาด', 'ผักชี', 'กะหล่ำปลี', 'มะเขือเทศ', 'แครอท', 'หัวหอม', 'กระเทียม',
      'พริก', 'พริกไทย', 'ขิง', 'ข่า', 'ตะไคร้', 'ใบมะกรูด',
      'น้ำตาล', 'เกลือ', 'น้ำปลา', 'ซีอิ๊ว', 'น้ำมันหอย',
      'ข้าว', 'เส้น', 'เส้นหมี่', 'เส้นใหญ่', 'วุ้นเส้น',
      'มะนาว', 'มะเขือ', 'ถั่ว', 'เต้าหู้', 'เห็ด',
      'กะทิ', 'หอม', 'กระเทียม', 'พริกชี้ฟ้า', 'พริกขี้หนู',
      'ใบกะเพรา', 'ใบโหระพา', 'ผักบุ้ง', 'คะน้า', 'บร็อคโคลี'
    ];
    
    // Get all unique category IDs
    const allCategories = Array.from(new Set(allMenus.map(m => m.category_id).filter(Boolean)));
    
    // Build user profile vector
    console.log('🔍 [ML] Building user profile vector...');
    const userVector = buildUserProfileVector(behaviorData, commonIngredients, allCategories);
    console.log('🔍 [ML] User vector length:', userVector.length);
    
    // Calculate similarity for each menu
    console.log('🔍 [ML] Calculating similarity scores...');
    const menuScores = allMenus.map(menu => {
      // Skip menus with allergens
      if (userProfile?.allergies) {
        const menuText = `${menu.menu_recipe || ''} ${menu.menu_description || ''}`.toLowerCase();
        const allergies = userProfile.allergies.toLowerCase().split(',').map(a => a.trim());
        if (allergies.some(allergy => menuText.includes(allergy))) {
          return { menu, similarity: -1, reason: 'Contains allergen' };
        }
      }
      
      // Build menu vector
      const menuVector = buildMenuVector(menu, commonIngredients, allCategories);
      
      // Calculate cosine similarity
      const similarity = cosineSimilarity(userVector, menuVector);
      
      // Penalize already viewed/liked menus slightly
      const viewData = (behaviorData.viewedMenus || []).find(vm => vm.menu_id === menu.menu_id);
      const likedData = (behaviorData.likedMenus || []).find(lm => lm.menu_id === menu.menu_id);
      const inMealPlan = (behaviorData.mealPlanHistory || []).some(mp => mp.menu_id === menu.menu_id);
      
      let adjustedSimilarity = similarity;
      if (viewData) adjustedSimilarity -= 0.05;
      if (likedData) adjustedSimilarity -= 0.03;
      if (inMealPlan) adjustedSimilarity -= 0.1;
      
      // Build reason
      const reasons = [];
      if (similarity > 0.3) reasons.push('High similarity to your preferences');
      const menuIngredients = extractIngredients(`${menu.menu_recipe || ''} ${menu.menu_description || ''}`, commonIngredients);
      const likedIngredients = (behaviorData.ingredientPrefs || [])
        .filter(p => p.preference_score > 0)
        .map(p => p.ingredient_name);
      const matchingIngredients = menuIngredients.filter(ing => likedIngredients.includes(ing));
      if (matchingIngredients.length > 0) {
        reasons.push(`Contains: ${matchingIngredients.slice(0, 3).join(', ')}`);
      }
      
      return {
        menu,
        similarity: Math.max(0, adjustedSimilarity),
        reason: reasons.join(' | ') || 'Based on ML similarity'
      };
    });
    
    // Filter out negative similarities (allergens) and sort by similarity
    console.log('🔍 [ML] Filtering and sorting recommendations...');
    const validScores = menuScores.filter(item => item.similarity >= 0);
    console.log('🔍 [ML] Valid scores (non-negative):', validScores.length);
    
    const recommendations = validScores
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map(({ menu, similarity, reason }) => ({
        menu_id: menu.menu_id,
        menu_name: menu.menu_name,
        menu_image: menu.menu_image,
        menu_description: menu.menu_description,
        reason: reason,
        matching_preferences: [reason],
        similarity_score: similarity.toFixed(3),
        exists_in_db: true
      }));
    
    console.log('✅ [ML] Generated', recommendations.length, 'recommendations');
    console.log('🔍 [ML] Top 3 similarities:', recommendations.slice(0, 3).map(r => ({ name: r.menu_name, score: r.similarity_score })));
    
    return {
      recommendations,
      method: 'ml_content_based'
    };
  } catch (error) {
    console.error('Error in ML recommendations:', error);
    return { recommendations: [], method: 'ml_content_based', error: true };
  }
}

// ==================== End ML-Based Recommendation System ====================

async function getRuleBasedRecommendations(behaviorData, userProfile) {
  try {
    // Get all menus
    const { data: allMenus } = await supabase
      .from('Menu')
      .select('menu_id, menu_name, menu_image, menu_description, menu_recipe, category_id');

    if (!allMenus || allMenus.length === 0) {
      return { recommendations: [], method: 'rule_based' };
    }

    // Score each menu based on behavior
    const scoredMenus = allMenus.map(menu => {
      let score = 0;
      const reasons = [];

      // Check ingredient preferences
      const menuText = `${menu.menu_recipe || ''} ${menu.menu_description || ''}`.toLowerCase();
      
      (behaviorData.ingredientPrefs || []).forEach(pref => {
        if (menuText.includes(pref.ingredient_name.toLowerCase())) {
          score += pref.preference_score;
          if (pref.preference_score > 0) {
            reasons.push(`Contains liked ingredient: ${pref.ingredient_name}`);
          }
        }
      });

      // Check category preferences
      const categoryPref = (behaviorData.categoryPrefs || [])
        .find(cp => cp.category_id === menu.category_id);
      if (categoryPref) {
        score += categoryPref.preference_score * 2; // Weight category preference higher
        reasons.push(`Preferred category: ${categoryPref.Category?.category_name}`);
      }

      // Check if frequently viewed
      const viewData = (behaviorData.viewedMenus || [])
        .find(vm => vm.menu_id === menu.menu_id);
      if (viewData) {
        score -= viewData.view_count * 0.1; // Slightly penalize already viewed items
      }

      // Check if already in meal plan
      const inMealPlan = (behaviorData.mealPlanHistory || [])
        .some(mp => mp.menu_id === menu.menu_id);
      if (inMealPlan) {
        score -= 0.5; // Penalize items already in meal plan
      }

      // Check allergies
      if (userProfile?.allergies) {
        const allergies = userProfile.allergies.toLowerCase().split(',').map(a => a.trim());
        const hasAllergy = allergies.some(allergy => menuText.includes(allergy));
        if (hasAllergy) {
          score = -1000; // Heavily penalize items with allergens
          reasons.push('Contains allergen');
        }
      }

      return {
        ...menu,
        score,
        reasons
      };
    });

    // Sort by score and take top 10
    const recommendations = scoredMenus
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ score, reasons, ...menu }) => ({
        menu_id: menu.menu_id,
        menu_name: menu.menu_name,
        menu_image: menu.menu_image,
        menu_description: menu.menu_description,
        reason: reasons.join(', ') || 'Based on general preferences',
        matching_preferences: reasons,
        exists_in_db: true
      }));

    return {
      recommendations,
      method: 'rule_based'
    };
  } catch (error) {
    console.error('Error in rule-based recommendations:', error);
    return { recommendations: [], method: 'rule_based', error: true };
  }
}

// Get personalized menu suggestions for specific meals
// ใช้ ML recommendations แทน AI
router.post('/ai/meal-suggestions', authMiddleware, async (req, res) => {
  const { meal_type, day_of_week } = req.body;
  const user_id = req.user.id;

  try {
    const behaviorData = await getUserBehaviorData(user_id);
    const { data: userProfile } = await supabase
      .from('User')
      .select('allergies, favorite_foods, calorie_limit')
      .eq('user_id', user_id)
      .single();

    // ใช้ ML recommendations แทน AI
    const mlRecommendations = await getMLRecommendations(behaviorData, userProfile);
    
    // ถ้า ML ให้ผลมา ให้ใช้ (slice แค่ 3 เมนูสำหรับ meal suggestions)
    if (mlRecommendations.recommendations && mlRecommendations.recommendations.length > 0) {
      return res.json({
        suggestions: mlRecommendations.recommendations.slice(0, 3),
        method: 'ml_content_based'
      });
    }

    // Fallback to rule-based
    const recommendations = await getRuleBasedRecommendations(behaviorData, userProfile);
    return res.json({
      suggestions: recommendations.recommendations.slice(0, 3),
      method: 'rule_based'
    });

  } catch (error) {
    console.error('Error generating meal suggestions:', error);
    res.status(500).json({ message: 'Failed to generate meal suggestions' });
  }
});

// Test endpoint (ไม่ต้อง auth - ใช้สำหรับทดสอบเท่านั้น)
// ⚠️ ควรลบหรือปิด endpoint นี้ใน production
router.get('/ai/recommendations/test', async (req, res) => {
  try {
    // ใช้ user_id จาก query parameter สำหรับทดสอบ
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ 
        message: 'กรุณาระบุ user_id ใน query parameter (เช่น ?user_id=U123456)' 
      });
    }

    // Fetch user behavior data
    const behaviorData = await getUserBehaviorData(user_id);
    
    // Get user profile preferences
    const { data: userProfile } = await supabase
      .from('User')
      .select('allergies, favorite_foods, calorie_limit')
      .eq('user_id', user_id)
      .single();

    // Try ML-based recommendations first
    const mlRecommendations = await getMLRecommendations(behaviorData, userProfile);
    
    if (mlRecommendations.recommendations && mlRecommendations.recommendations.length >= 5) {
      return res.json({
        ...mlRecommendations,
        note: '⚠️ This is a test endpoint. Use /ai/recommendations with auth in production.'
      });
    }

    // Fallback to rule-based
    const ruleBased = await getRuleBasedRecommendations(behaviorData, userProfile);
    res.json({
      ...ruleBased,
      note: '⚠️ This is a test endpoint. Use /ai/recommendations with auth in production.'
    });
  } catch (error) {
    console.error('Error in test recommendations:', error);
    res.status(500).json({ message: 'Failed to generate recommendations', error: error.message });
  }
});

module.exports = router;
