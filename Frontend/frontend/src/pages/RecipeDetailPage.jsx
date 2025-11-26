import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import ConfirmationModal from '../components/ConfirmationModal';
import ReportModal from '../components/ReportModal';
import { API_URL, IMAGE_URL } from '../config/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

async function fetchPlanFromAPI(token) {
  try {
    const resp = await fetch(`${API_URL}/weekly-meal-plan`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data;
  } catch (error) {
    console.error('Error fetching plan:', error);
    return null;
  }
}

async function findMenuIdByName(menuName) {
  try {
    const resp = await fetch(`${API_URL}/menus/search?q=${encodeURIComponent(menuName)}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    // หาเมนูที่ชื่อตรงกัน
    const menu = data.find(m => m.menu_name === menuName);
    return menu
      ? {
          id: menu.menu_id,
          likeCount: menu.menu_like_count || 0
        }
      : null;
  } catch (error) {
    console.error('Error finding menu:', error);
    return null;
  }
}

async function addMenuToPlan(day, mealType, menuId, token) {
  try {
    const resp = await fetch(`${API_URL}/weekly-meal-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        day,
        meal_type: mealType,
        menu_id: menuId
      })
    });
    if (!resp.ok) {
      const errorData = await resp.json();
      throw new Error(errorData.error || errorData.message || 'Failed to add menu');
    }
    const data = await resp.json();
    return data;
  } catch (error) {
    console.error('Error adding menu:', error);
    throw error;
  }
}

function RecipeDetailPage() {
  const { recipeId } = useParams(); // ดึง ID ของเมนูมาจาก URL
  const navigate = useNavigate();
  const { token, user } = useContext(AuthContext);
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pickDay, setPickDay] = useState('Mon');
  const [pickMeal, setPickMeal] = useState('dinner');
  const [added, setAdded] = useState('');
  const [plan, setPlan] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  useEffect(() => {
    const fetchRecipeDetails = async () => {
      setLoading(true);
      try {
        // ตรวจสอบว่าเป็นสูตรอาหารจากผู้ใช้ (recipe_id ขึ้นต้นด้วย "R") หรือเมนูจากระบบ
        if (recipeId && recipeId.startsWith('R')) {
          // ดึงสูตรอาหารจากผู้ใช้
          const headers = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
            headers
          });
          if (!response.ok) {
            throw new Error('ไม่พบสูตรอาหารนี้');
          }
          const userRecipe = await response.json();
          
          // แปลงเป็นรูปแบบเดียวกับเมนูจากระบบเพื่อให้แสดงผลได้เหมือนกัน
          setRecipe({
            strMeal: userRecipe.recipe_title,
            strCategory: userRecipe.recipe_category || 'สูตรจากผู้ใช้',
            strArea: `โดย ${userRecipe.user_fname || 'ผู้ใช้'}`,
            strMealThumb: userRecipe.recipe_image 
              ? (userRecipe.recipe_image.startsWith('http') 
                  ? userRecipe.recipe_image 
                  : `${IMAGE_URL}/${userRecipe.recipe_image}`)
              : null,
            strInstructions: userRecipe.steps 
              ? userRecipe.steps.map((step, idx) => `${idx + 1}. ${step.detail || step}`).join('\n\n')
              : '',
            ingredients: userRecipe.ingredients || [],
            isUserRecipe: true,
            userRecipe: userRecipe,
            prep_time_minutes: userRecipe.prep_time_minutes,
            cook_time_minutes: userRecipe.cook_time_minutes,
            total_time_minutes: userRecipe.total_time_minutes,
            servings: userRecipe.servings,
            recipe_summary: userRecipe.recipe_summary,
            user_id: userRecipe.user_id
          });
          
          // ตั้งค่า like count และสถานะ like
          setLikeCount(userRecipe.like_count || 0);
          setLiked(userRecipe.isLiked || false);
        } else {
          // ดึงเมนูจากระบบ (Thai Food API)
          // ใช้ recipeId โดยตรงเป็น menu_id เพื่อไม่ต้อง search อีก
          const response = await fetch(`${API_URL}/thai-food/lookup.php?i=${recipeId}`);
          const data = await response.json();
          console.log('Thai Food API Response:', data); // Debug log
          if (data.meals && data.meals.length > 0) {
            setRecipe(data.meals[0]);
            // ตั้งค่า menu_id โดยตรงจาก recipeId (ไม่ต้อง search)
            setMenuId(recipeId);
            
            // Track menu view (fire-and-forget ไม่ await เพื่อไม่ให้ช้า)
            if (token && user?.user_id) {
              fetch(`${API_URL}/behavior/menu/view`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ menu_id: recipeId, user_id: user.user_id })
              }).catch(error => {
                console.error('Failed to track menu view:', error);
              });
            }
          } else {
            console.error('No meals found in response');
            setRecipe(null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch recipe details:", error);
        setRecipe(null);
      } finally {
        setLoading(false);
      }
    };
    fetchRecipeDetails();
  }, [recipeId, token, user]);

  // โหลด plan เมื่อ recipe โหลดเสร็จและมี token
  // menu_id ถูกตั้งค่าแล้วใน useEffect แรก (ไม่ต้อง search อีก)
  useEffect(() => {
    if (recipe && token && !recipe.isUserRecipe) {
      const loadPlan = async () => {
        setLoadingPlan(true);
        try {
          // ดึง plan
          const planData = await fetchPlanFromAPI(token);
          setPlan(planData);
        } finally {
          setLoadingPlan(false);
        }
      };
      loadPlan();
    }
  }, [recipe, token]);

  // Reload plan เมื่อเปลี่ยนวันหรือมื้อ
  useEffect(() => {
    if (token && recipe) {
      fetchPlanFromAPI(token).then(planData => {
        if (planData) setPlan(planData);
      });
    }
  }, [pickDay, pickMeal, token, recipe]);

  // ตรวจสอบว่าเป็นเจ้าของสูตรหรือไม่
  const isOwner = recipe?.isUserRecipe && recipe?.user_id && user?.user_id === recipe.user_id;
  const isAdmin = user?.isAdmin === true;
  
  // แสดงว่า admin สามารถลบสูตรอาหารใดก็ได้
  const canDelete = recipe?.isUserRecipe && (isOwner || isAdmin);

  // ฟังก์ชันสำหรับกด like/unlike สูตรอาหาร
  const handleToggleLike = async () => {
    if (!token) {
      alert('กรุณาเข้าสู่ระบบเพื่อกดไลค์สูตรอาหาร');
      return;
    }
    if (!recipeId || !recipe?.isUserRecipe) return;
    if (likeLoading) return;

    setLikeLoading(true);
    try {
      const response = await fetch(`${API_URL}/recipes/${recipeId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถกดไลค์สูตรอาหารได้');
      }

      setLikeCount(data.like_count || 0);
      setLiked(data.liked || false);
    } catch (error) {
      console.error('Error toggling like:', error);
      alert(error.message || 'เกิดข้อผิดพลาดในการกดไลค์สูตรอาหาร');
    } finally {
      setLikeLoading(false);
    }
  };

  // ฟังก์ชันสำหรับลบสูตรอาหาร
  const handleDeleteRecipe = async () => {
    if (!token || !recipeId) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถลบสูตรอาหารได้');
      }

      alert('ลบสูตรอาหารสำเร็จ');
      navigate('/menus');
    } catch (error) {
      console.error('Delete error:', error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  // ฟังก์ชันสำหรับจัดรูปแบบวัตถุดิบและปริมาณ
  const getIngredients = (recipeData) => {
    // ถ้าเป็นสูตรอาหารจากผู้ใช้
    if (recipeData.isUserRecipe && recipeData.ingredients) {
      return recipeData.ingredients.map(ing => {
        if (typeof ing === 'string') return ing;
        return `${ing.name || ''}${ing.amount ? ` - ${ing.amount}` : ''}`;
      }).filter(Boolean);
    }
    
    // ถ้าเป็นเมนูจากระบบ (TheMealDB format)
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ingredient = recipeData[`strIngredient${i}`];
      const measure = recipeData[`strMeasure${i}`];
      if (ingredient && ingredient.trim() !== "") {
        ingredients.push(`${ingredient} - ${measure}`);
      }
    }
    return ingredients;
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Navbar />
          <main className="flex-grow flex items-center justify-center"><p>กำลังโหลดข้อมูลสูตรอาหาร...</p></main>
        </div>
    );
  }

  if (!recipe) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Navbar />
            <main className="flex-grow flex items-center justify-center"><h1 className="text-2xl font-bold">ไม่พบสูตรอาหารนี้</h1></main>
        </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-grow pt-24">
        <div className="container mx-auto px-6 sm:px-8 py-8">
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => navigate('/menus')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">ย้อนกลับ</span>
              </button>
              {recipe.isUserRecipe && (
                <div className="flex gap-2 items-center">
                  {/* ปุ่ม Like */}
                  <button
                    onClick={handleToggleLike}
                    disabled={likeLoading || !token}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      liked 
                        ? 'bg-rose-500 text-white hover:bg-rose-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${likeLoading || !token ? 'opacity-60 cursor-not-allowed' : ''}`}
                    title={!token ? 'กรุณาเข้าสู่ระบบเพื่อกดไลค์' : ''}
                  >
                    <svg
                      className={`w-5 h-5 ${liked ? 'fill-current' : ''}`}
                      viewBox="0 0 24 24"
                      fill={liked ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M12 21s-5.434-4.45-8.152-7.168C1.97 11.954 1 10.329 1 8.5 1 5.995 2.995 4 5.5 4c1.57 0 3.057.874 3.862 2.253C10.443 4.874 11.93 4 13.5 4 16.005 4 18 5.995 18 8.5c0 1.83-.97 3.454-2.848 5.332C17.434 16.55 12 21 12 21z" />
                    </svg>
                    <span className="font-semibold">{likeCount}</span>
                  </button>
                  
                  {token && (
                    <>
                      {isOwner && (
                        <button
                          onClick={() => navigate(`/menus/${recipeId}/edit`)}
                          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l10.768-10.768a1 1 0 000-1.414l-2.586-2.586a1 1 0 00-1.414 0L4 16v4z" />
                          </svg>
                          แก้ไขสูตรอาหาร
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setIsDeleteModalOpen(true)}
                          disabled={deleting}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                          title={isAdmin && !isOwner ? 'ลบในฐานะ Admin' : 'ลบสูตรอาหาร'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {deleting ? 'กำลังลบ...' : 'ลบสูตรอาหาร'}
                        </button>
                      )}
                      {!canDelete && !isOwner && (
                        <button
                          onClick={() => setIsReportModalOpen(true)}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          รายงาน
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <h1 className="text-4xl font-bold mb-4">{recipe.strMeal}</h1>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <p className="text-gray-500">
                {recipe.strCategory} | {' '}
                {recipe.isUserRecipe && recipe.user_id ? (
                  <>
                    โดย{' '}
                    <button
                      onClick={() => navigate(`/users/${recipe.user_id}`)}
                      className="text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
                    >
                      {recipe.userRecipe?.user_fname || 'ผู้ใช้'}
                    </button>
                  </>
                ) : (
                  recipe.strArea
                )}
              </p>
              {recipe.isUserRecipe && recipe.prep_time_minutes && (
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  เวลาเตรียม: {recipe.prep_time_minutes} นาที
                </span>
              )}
              {recipe.isUserRecipe && recipe.cook_time_minutes && (
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  เวลาปรุง: {recipe.cook_time_minutes} นาที
                </span>
              )}
              {recipe.isUserRecipe && recipe.total_time_minutes && (
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  เวลารวม: {recipe.total_time_minutes} นาที
                </span>
              )}
              {recipe.isUserRecipe && recipe.servings && (
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  เสิร์ฟ: {recipe.servings} ที่
                </span>
              )}
            </div>
            {recipe.isUserRecipe && recipe.recipe_summary && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                <p className="text-gray-700">{recipe.recipe_summary}</p>
              </div>
            )}
            {!recipe.isUserRecipe && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-6">
              <div className="text-sm font-medium mb-3">เพิ่มลงแผนสัปดาห์:</div>
              <div className="flex flex-wrap items-center gap-3">
                <select 
                  value={pickDay} 
                  onChange={(e) => setPickDay(e.target.value)} 
                  className="border rounded px-3 py-2 text-sm"
                >
                  {DAYS.map(d => (<option key={d} value={d}>{d}</option>))}
                </select>
                <div className="flex gap-2">
                  {MEALS.map(meal => {
                    // ตรวจสอบว่าเมนูปัจจุบันถูกเลือกไปแล้วในวัน/มื้อนี้หรือไม่
                    const isCurrentMenuSelected = plan && menuId && plan[pickDay]?.[meal]?.some(m => m.id === menuId);
                    // ตรวจสอบว่ามีเมนูอื่นอยู่แล้วในวัน/มื้อนี้หรือไม่
                    const isSlotOccupied = plan && plan[pickDay]?.[meal]?.length > 0;
                    const isCurrentSelection = pickMeal === meal;
                    
                    return (
                      <button
                        key={meal}
                        onClick={() => {
                          if (!isCurrentMenuSelected) {
                            setPickMeal(meal);
                          }
                        }}
                        className={`px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                          isCurrentSelection
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : isCurrentMenuSelected
                            ? 'bg-red-100 border-red-300 text-red-700 cursor-not-allowed opacity-75'
                            : isSlotOccupied
                            ? 'bg-orange-100 border-orange-300 text-orange-700'
                            : 'bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                        disabled={isCurrentMenuSelected}
                      >
                        {meal}
                        {isCurrentMenuSelected && <span className="ml-1 text-xs">✓</span>}
                        {isSlotOccupied && !isCurrentMenuSelected && <span className="ml-1 text-xs">(มีอื่น)</span>}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={async () => {
                    if (!token) {
                      alert('กรุณาเข้าสู่ระบบเพื่อใช้งานฟีเจอร์นี้');
                      return;
                    }
                    if (!menuId) {
                      alert('ไม่พบเมนูนี้ในฐานข้อมูล กรุณาเพิ่มเมนูในฐานข้อมูลก่อน');
                      return;
                    }
                    
                    // ตรวจสอบว่าเมนูถูกเลือกไปแล้วหรือยัง
                    const isAlreadySelected = plan && menuId && plan[pickDay]?.[pickMeal]?.some(m => m.id === menuId);
                    if (isAlreadySelected) {
                      alert('เมนูนี้ถูกเลือกไปแล้วในวัน/มื้อนี้');
                      return;
                    }
                    
                    setAdding(true);
                    try {
                      await addMenuToPlan(pickDay, pickMeal, menuId, token);
                      setAdded('เพิ่มแล้ว!');
                      setTimeout(() => setAdded(''), 3000);
                      
                      // Reload plan
                      const planData = await fetchPlanFromAPI(token);
                      setPlan(planData);
                    } catch (error) {
                      alert(error.message || 'เกิดข้อผิดพลาดในการเพิ่มเมนู');
                    } finally {
                      setAdding(false);
                    }
                  }}
                  disabled={adding || !token || !menuId || (plan && menuId && plan[pickDay]?.[pickMeal]?.some(m => m.id === menuId))}
                  className="bg-emerald-600 text-white rounded px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? 'กำลังเพิ่ม...' : (plan && menuId && plan[pickDay]?.[pickMeal]?.some(m => m.id === menuId) ? 'ถูกเลือกแล้ว' : 'เพิ่ม')}
                </button>
                {added && <span className="text-emerald-700 text-sm font-medium">{added}</span>}
              </div>
              {!token && (
                <div className="mt-2 text-xs text-gray-500">กรุณาเข้าสู่ระบบเพื่อใช้งานฟีเจอร์นี้</div>
              )}
            </div>
            )}
            
            {recipe.strMealThumb && (
              <img 
                src={
                  recipe.strMealThumb.startsWith('http') 
                    ? recipe.strMealThumb 
                    : `${IMAGE_URL}/${recipe.strMealThumb}`
                } 
                alt={recipe.strMeal} 
                className="w-full rounded-lg mb-6 shadow-md" 
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1">
                <h2 className="text-2xl font-bold mb-4">วัตถุดิบ</h2>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {getIngredients(recipe).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="md:col-span-2">
                <h2 className="text-2xl font-bold mb-4">วิธีทำ</h2>
                <div className="prose max-w-none text-gray-800" style={{ whiteSpace: 'pre-wrap' }}>
                  {recipe.isUserRecipe 
                    ? (recipe.strInstructions || recipe.userRecipe?.steps?.map((step, idx) => `${idx + 1}. ${typeof step === 'object' ? (step.detail || step) : step}`).join('\n\n') || '')
                    : recipe.strInstructions
                  }
                </div>
              </div>
            </div>
            
            {!recipe.isUserRecipe && recipe.strYoutube && (
              <div className="mt-8 text-center">
                <a href={recipe.strYoutube} target="_blank" rel="noopener noreferrer" className="inline-block bg-red-600 text-white font-bold rounded-full px-6 py-3 hover:bg-red-700 transition-colors">
                  ดูวิดีโอวิธีทำบน YouTube
                </a>
              </div>
            )}

            {/* แหล่งอ้างอิง (เฉพาะเมนูจากระบบ) */}
            {!recipe.isUserRecipe && (recipe.strSource || recipe.strSourceUrl) && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="bg-gray-50 rounded-lg p-4 lg:p-6">
                  <h3 className="text-base lg:text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    แหล่งอ้างอิง
                  </h3>
                  <div className="text-sm lg:text-base text-gray-700">
                    {recipe.strSource && (
                      <div className="font-medium text-gray-800 mb-2">
                        {recipe.strSource}
                      </div>
                    )}
                    {recipe.strSourceUrl && (
                      <div className="mt-2">
                        <a 
                          href={recipe.strSourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 hover:underline break-all inline-flex items-center gap-1 transition-colors"
                        >
                          <span>{recipe.strSourceUrl}</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteRecipe}
        title="คุณแน่ใจหรือไม่ว่าต้องการลบสูตรอาหารนี้?"
      />

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        recipeId={recipe?.isUserRecipe ? recipeId : null}
        onReportSubmitted={() => {
          setIsReportModalOpen(false);
        }}
      />
    </div>
  );
}

export default RecipeDetailPage;