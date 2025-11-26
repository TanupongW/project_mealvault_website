import React, { useState, useEffect, useMemo, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import AddMenuModal from '../components/AddMenuModal';
import ReportModal from '../components/ReportModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { API_URL, IMAGE_URL } from '../config/api';
const ALL_CATEGORY = 'ALL';
const UNCATEGORIZED = 'UNCATEGORIZED';

function formatDateThai(dateString) {
  if (!dateString) return 'ไม่ระบุ';
  try {
    return new Date(dateString).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'ไม่ระบุ';
  }
}

function RecipeCard({ recipe, token, user, onDelete, onReport, recipeRef, isHighlighted }) {
  const navigate = useNavigate();
  const recipeImages = (recipe.cpost_images && recipe.cpost_images.length > 0) ? recipe.cpost_images : [];
  const coverImage = recipeImages.length > 0 ? recipeImages[0] : recipe.cpost_image;
  const imageSrc = coverImage
    ? (coverImage.startsWith('http') ? coverImage : `${IMAGE_URL}/${coverImage}`)
    : 'https://via.placeholder.com/400x260.png?text=MealVault';
  const summary = recipe.cpost_content || recipe.recipe?.recipe_summary || 'ยังไม่มีคำอธิบายสูตรอาหารนี้';
  const [likeCount, setLikeCount] = useState(recipe.like_count || 0);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  
  // ตรวจสอบว่าเป็นเจ้าของสูตรหรือไม่
  const isOwner = recipe.user_id && user?.user_id === recipe.user_id;
  
  // ตรวจสอบว่าเป็น admin หรือไม่
  const isAdmin = user?.isAdmin === true;

  // ตรวจสอบว่าเป็น UserRecipe (มี recipe_id และ post_type === 'recipe') หรือ CommunityPost
  // หมายเหตุ: API ส่ง cpost_id: recipe.recipe_id มาด้วย ดังนั้นต้องตรวจสอบ post_type
  const isUserRecipe = recipe.post_type === 'recipe' && recipe.recipe_id;
  const recipeId = recipe.recipe_id || recipe.cpost_id;

  useEffect(() => {
    setLikeCount(recipe.like_count || 0);
    setLiked(recipe.isLiked || false);
  }, [recipeId, recipe.like_count, recipe.isLiked]);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      if (!token || !recipeId) {
        setLiked(false);
        return;
      }
      try {
        // ตรวจสอบว่าเป็น UserRecipe หรือ CommunityPost
        const url = isUserRecipe 
          ? `${API_URL}/recipes/${recipeId}`
          : `${API_URL}/posts/${recipeId}`;
        
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled) {
          setLikeCount(data.like_count ?? 0);
          setLiked(!!data.isLiked);
        }
      } catch (error) {
        console.error('Failed to fetch recipe like status:', error);
      }
    };
    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [token, recipeId, isUserRecipe]);

  const handleToggleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      alert('กรุณาเข้าสู่ระบบเพื่อกดไลค์สูตรอาหาร');
      return;
    }
    if (likeLoading || !recipeId) return;

    setLikeLoading(true);
    try {
      // ตรวจสอบว่าเป็น UserRecipe หรือ CommunityPost
      const url = isUserRecipe 
        ? `${API_URL}/recipes/${recipeId}/like`
        : `${API_URL}/posts/${recipeId}/like`;
      
      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'ไม่สามารถกดไลค์สูตรอาหารได้');
      setLikeCount(data.like_count ?? 0);
      setLiked(!!data.liked);
    } catch (error) {
      alert(error.message || 'เกิดข้อผิดพลาดในการกดไลค์สูตรอาหาร');
    } finally {
      setLikeLoading(false);
    }
  };

  return (
    <div 
      ref={recipeRef}
      className={`group bg-white rounded-[1.75rem] shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col ${
        isHighlighted ? 'border-4 border-red-500 ring-4 ring-red-300 animate-pulse' : 'border border-gray-100'
      }`}
    >
      <div className="relative h-56 overflow-hidden">
        <img
          src={imageSrc}
          alt={recipe.cpost_title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/90 text-white shadow">
            สูตรจากผู้ใช้
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggleLike}
          disabled={likeLoading}
          className={`absolute top-4 right-4 flex items-center gap-1 px-3 py-1 rounded-full font-semibold shadow transition ${
            liked ? 'bg-rose-600 text-white' : 'bg-white/90 text-rose-500'
          } ${likeLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white'}`}
        >
          <svg
            className={`w-4 h-4 ${liked ? 'fill-current' : ''}`}
            viewBox="0 0 24 24"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M12 21s-5.434-4.45-8.152-7.168C1.97 11.954 1 10.329 1 8.5 1 5.995 2.995 4 5.5 4c1.57 0 3.057.874 3.862 2.253C10.443 4.874 11.93 4 13.5 4 16.005 4 18 5.995 18 8.5c0 1.83-.97 3.454-2.848 5.332C17.434 16.55 12 21 12 21z" />
          </svg>
          {likeCount}
        </button>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h3 className="text-xl font-semibold drop-shadow-md line-clamp-1">{recipe.cpost_title}</h3>
          <p className="text-sm text-white/80 line-clamp-2">{summary}</p>
        </div>
      </div>
      <div className="p-5 space-y-4 flex-1 flex flex-col">
        <div className="flex items-center text-xs text-gray-400 gap-2">
          <span>{formatDateThai(recipe.cpost_datetime)}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300" />
          <span>โดย {recipe.user_fname || 'ผู้ใช้'}</span>
        </div>
        {(() => {
          try {
            const recipeData = recipe.cpost_content ? JSON.parse(recipe.cpost_content) : null;
            return recipeData?.recipe_summary ? (
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-sm text-gray-600 line-clamp-3">
                {recipeData.recipe_summary}
              </div>
            ) : null;
          } catch {
            return null;
          }
        })()}
        <div className="mt-auto flex gap-3">
          <button
            type="button"
            onClick={() => navigate(`/menus/${recipe.recipe_id || recipe.cpost_id}`)}
            className="flex-1 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow"
          >
            ดูรายละเอียด
          </button>
          {token && (
            <>
              {isOwner && isUserRecipe && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/menus/${recipe.recipe_id || recipe.cpost_id}/edit`);
                  }}
                  className="px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
                  title="แก้ไขสูตรอาหาร"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l10.768-10.768a1 1 0 000-1.414l-2.586-2.586a1 1 0 00-1.414 0L4 16v4z" />
                  </svg>
                </button>
              )}
              {(isOwner || (isAdmin && isUserRecipe)) && onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(recipe.recipe_id || recipe.cpost_id);
                  }}
                  className="px-4 py-2 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                  title={isAdmin && !isOwner ? "ลบในฐานะ Admin" : "ลบสูตรอาหาร"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              {!isOwner && !isAdmin && onReport && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onReport(recipe.recipe_id || recipe.cpost_id);
                  }}
                  className="px-4 py-2 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                  title="รายงานสูตรอาหาร"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const url = `${window.location.origin}/menus/${recipe.recipe_id || recipe.cpost_id}`;
              navigator.clipboard.writeText(url).then(() => {
                alert('คัดลอกลิงก์แล้ว!');
              }).catch(() => {
                alert('ไม่สามารถคัดลอกลิงก์ได้');
              });
            }}
            className="px-4 py-2 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold hover:border-gray-300 hover:text-gray-800 transition-colors"
          >
            แชร์
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuCard({ menu, categoryName, token, user }) {
  const navigate = useNavigate();
  const imageSrc = menu.menu_image
    ? (menu.menu_image.startsWith('http') ? menu.menu_image : `${IMAGE_URL}/${menu.menu_image}`)
    : 'https://via.placeholder.com/400x260.png?text=MealVault';
  const summary = menu.menu_description || menu.menu_recipe || 'ยังไม่มีคำอธิบายเมนูนี้';
  const [likeCount, setLikeCount] = useState(menu.menu_like_count || 0);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  useEffect(() => {
    setLikeCount(menu.menu_like_count || 0);
    setLiked(false);
  }, [menu.menu_id, menu.menu_like_count]);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      if (!token) {
        setLiked(false);
        return;
      }
      try {
        const resp = await fetch(`${API_URL}/menus/${menu.menu_id}/likes`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled) {
          setLikeCount(data.like_count ?? 0);
          setLiked(!!data.liked);
        }
      } catch (error) {
        console.error('Failed to fetch menu like status:', error);
      }
    };
    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [token, menu.menu_id]);

  const handleToggleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      alert('กรุณาเข้าสู่ระบบเพื่อกดไลค์เมนู');
      return;
    }
    if (likeLoading) return;

    setLikeLoading(true);
    try {
      const resp = await fetch(`${API_URL}/menus/${menu.menu_id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'ไม่สามารถกดไลค์เมนูได้');
      setLikeCount(data.like_count ?? 0);
      setLiked(!!data.liked);
    } catch (error) {
      alert(error.message || 'เกิดข้อผิดพลาดในการกดไลค์เมนู');
    } finally {
      setLikeLoading(false);
    }
  };

  return (
    <div className="group bg-white rounded-[1.75rem] shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col">
      <div className="relative h-56 overflow-hidden">
        <img
          src={imageSrc}
          alt={menu.menu_name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-white/90 text-emerald-700 shadow">
            {categoryName || 'หมวดหมู่ทั่วไป'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggleLike}
          disabled={likeLoading}
          className={`absolute top-4 right-4 flex items-center gap-1 px-3 py-1 rounded-full font-semibold shadow transition ${
            liked ? 'bg-rose-600 text-white' : 'bg-white/90 text-rose-500'
          } ${likeLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white'}`}
        >
          <svg
            className={`w-4 h-4 ${liked ? 'fill-current' : ''}`}
            viewBox="0 0 24 24"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M12 21s-5.434-4.45-8.152-7.168C1.97 11.954 1 10.329 1 8.5 1 5.995 2.995 4 5.5 4c1.57 0 3.057.874 3.862 2.253C10.443 4.874 11.93 4 13.5 4 16.005 4 18 5.995 18 8.5c0 1.83-.97 3.454-2.848 5.332C17.434 16.55 12 21 12 21z" />
          </svg>
          {likeCount}
        </button>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h3 className="text-xl font-semibold drop-shadow-md line-clamp-1">{menu.menu_name}</h3>
          <p className="text-sm text-white/80 line-clamp-2">{summary}</p>
        </div>
      </div>
      <div className="p-5 space-y-4 flex-1 flex flex-col">
        <div className="flex items-center text-xs text-gray-400 gap-2">
          <span>{formatDateThai(menu.menu_datetime)}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300" />
          <span>สร้างโดย {menu.user_id ? `ID: ${menu.user_id}` : 'ระบบ'}</span>
        </div>
        {menu.menu_recipe && (
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-sm text-gray-600 line-clamp-3">
            {menu.menu_recipe}
          </div>
        )}
        <div className="mt-auto flex gap-3">
          <button
            type="button"
            onClick={() => {
              // Navigate ทันทีเพื่อให้เร็วขึ้น
              // การ track menu view จะทำใน RecipeDetailPage เมื่อโหลดหน้าเสร็จแล้ว
              navigate(`/menus/${menu.menu_id}`);
            }}
            className="flex-1 px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow"
          >
            ดูรายละเอียด
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const url = `${window.location.origin}/menus/${menu.menu_id}`;
              navigator.clipboard.writeText(url).then(() => {
                alert('คัดลอกลิงก์แล้ว!');
              }).catch(() => {
                alert('ไม่สามารถคัดลอกลิงก์ได้');
              });
            }}
            className="px-4 py-2 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold hover:border-gray-300 hover:text-gray-800 transition-colors"
          >
            แชร์
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuPage() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [menus, setMenus] = useState([]);
  const [userRecipes, setUserRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [error, setError] = useState('');
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false);
  const [isCreateRecipeModalOpen, setIsCreateRecipeModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // สำหรับ highlight สูตรอาหารที่ถูกรายงาน
  const highlightedRecipeId = searchParams.get('recipe');
  const isReported = searchParams.get('reported') === 'true';
  const recipeRefs = useRef({});
  
  // Recipe form states
  const [recipeTitle, setRecipeTitle] = useState('');
  const [recipeSummary, setRecipeSummary] = useState('');
  const [recipeCategory, setRecipeCategory] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [totalTime, setTotalTime] = useState('');
  const [servings, setServings] = useState('');
  const [ingredients, setIngredients] = useState([{ name: '', amount: '' }]);
  const [steps, setSteps] = useState([{ detail: '' }]);
  const [imageFile, setImageFile] = useState(null);
  const [submittingRecipe, setSubmittingRecipe] = useState(false);
  const [recipeError, setRecipeError] = useState('');
  const [recipeSuccess, setRecipeSuccess] = useState('');
  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((cat) => {
      map[cat.category_id] = cat.category_name;
    });
    return map;
  }, [categories]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [menuResp, categoryResp] = await Promise.all([
          fetch(`${API_URL}/menus`),
          fetch(`${API_URL}/categories`)
        ]);

        if (!menuResp.ok) {
          throw new Error('ไม่สามารถดึงข้อมูลเมนูได้');
        }
        if (!categoryResp.ok) {
          throw new Error('ไม่สามารถดึงข้อมูลหมวดหมู่ได้');
        }

        const menuData = await menuResp.json();
        const categoryData = await categoryResp.json();

        setMenus(Array.isArray(menuData) ? menuData : []);
        setCategories(Array.isArray(categoryData) ? categoryData : []);
      } catch (err) {
        setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchUserRecipes = async () => {
      setLoadingRecipes(true);
      try {
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const resp = await fetch(`${API_URL}/recipes`, {
          headers
        });
        if (!resp.ok) throw new Error('ไม่สามารถดึงข้อมูลสูตรอาหารได้');
        const recipes = await resp.json();
        setUserRecipes(Array.isArray(recipes) ? recipes : []);
      } catch (err) {
        console.error('Error fetching user recipes:', err);
        setUserRecipes([]);
      } finally {
        setLoadingRecipes(false);
      }
    };

    fetchUserRecipes();
  }, [token]);

  const handleDeleteRecipe = (recipeId) => {
    setSelectedRecipeId(recipeId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteRecipe = async () => {
    if (!token || !selectedRecipeId) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/recipes/${selectedRecipeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถลบสูตรอาหารได้');
      }

      // Refresh recipes list
      const fetchUserRecipes = async () => {
        try {
          const headers = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          const resp = await fetch(`${API_URL}/recipes`, {
            headers
          });
          if (resp.ok) {
            const recipes = await resp.json();
            setUserRecipes(Array.isArray(recipes) ? recipes : []);
          }
        } catch (err) {
          console.error('Error refreshing recipes:', err);
        }
      };
      fetchUserRecipes();
      
      setIsDeleteModalOpen(false);
      setSelectedRecipeId(null);
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleReportRecipe = (recipeId) => {
    setSelectedRecipeId(recipeId);
    setIsReportModalOpen(true);
  };
  
  // Scroll และ highlight สูตรอาหารที่ถูกรายงาน
  useEffect(() => {
    if (highlightedRecipeId && userRecipes.length > 0 && !loadingRecipes) {
      setTimeout(() => {
        const element = recipeRefs.current[highlightedRecipeId];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-red-500', 'ring-offset-4');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-red-500', 'ring-offset-4');
          }, 3000);
        }
      }, 500);
    }
  }, [highlightedRecipeId, userRecipes, loadingRecipes]);

  const handleAddMenuSuccess = () => {
    // Refresh menu list after successful addition
    const fetchData = async () => {
      try {
        const menuResp = await fetch(`${API_URL}/menus`);
        if (menuResp.ok) {
          const menuData = await menuResp.json();
          setMenus(Array.isArray(menuData) ? menuData : []);
        }
      } catch (err) {
        console.error('Error refreshing menus:', err);
      }
    };
    fetchData();
  };

  const updateIngredient = (index, field, value) => {
    setIngredients(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item));
  };

  const addIngredient = () => {
    setIngredients(prev => [...prev, { name: '', amount: '' }]);
  };

  const removeIngredient = (index) => {
    setIngredients(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateStep = (index, value) => {
    setSteps(prev => prev.map((item, idx) => idx === index ? { detail: value } : item));
  };

  const addStep = () => setSteps(prev => [...prev, { detail: '' }]);

  const removeStep = (index) => {
    setSteps(prev => prev.filter((_, idx) => idx !== index));
  };

  const resetRecipeForm = () => {
    setRecipeTitle('');
    setRecipeSummary('');
    setRecipeCategory('');
    setPrepTime('');
    setCookTime('');
    setTotalTime('');
    setServings('');
    setIngredients([{ name: '', amount: '' }]);
    setSteps([{ detail: '' }]);
    setImageFile(null);
    setRecipeError('');
    setRecipeSuccess('');
  };

  const handleCreateRecipe = async (e) => {
    e.preventDefault();
    setRecipeError('');
    setRecipeSuccess('');

    if (!token) {
      setRecipeError('กรุณาเข้าสู่ระบบเพื่อสร้างสูตรอาหาร');
      return;
    }

    const filteredIngredients = ingredients.filter(item => item.name.trim());
    const filteredSteps = steps.filter(item => item.detail.trim());

    if (!recipeTitle.trim()) {
      setRecipeError('กรุณากรอกชื่อสูตรอาหาร');
      return;
    }
    if (filteredIngredients.length === 0) {
      setRecipeError('กรุณาระบุวัตถุดิบอย่างน้อย 1 รายการ');
      return;
    }
    if (filteredSteps.length === 0) {
      setRecipeError('กรุณาระบุขั้นตอนอย่างน้อย 1 ขั้น');
      return;
    }

    setSubmittingRecipe(true);
    try {
      const formData = new FormData();
      formData.append('recipe_title', recipeTitle);
      formData.append('recipe_summary', recipeSummary);
      formData.append('recipe_category', recipeCategory);
      formData.append('prep_time_minutes', prepTime);
      formData.append('cook_time_minutes', cookTime);
      formData.append('total_time_minutes', totalTime);
      formData.append('servings', servings);
      formData.append('ingredients', JSON.stringify(filteredIngredients));
      formData.append('steps', JSON.stringify(filteredSteps.map((item, index) => ({
        order: index + 1,
        detail: item.detail
      }))));
      if (imageFile) {
        formData.append('recipe_image', imageFile);
      }

      const response = await fetch(`${API_URL}/recipes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถสร้างสูตรอาหารได้');
      }

      setRecipeSuccess('สร้างสูตรอาหารสำเร็จ!');
      resetRecipeForm();
      
      // Refresh recipes list
      const fetchUserRecipes = async () => {
        try {
          const headers = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          const resp = await fetch(`${API_URL}/recipes`, {
            headers
          });
          if (resp.ok) {
            const recipes = await resp.json();
            setUserRecipes(Array.isArray(recipes) ? recipes : []);
          }
        } catch (err) {
          console.error('Error refreshing recipes:', err);
        }
      };
      fetchUserRecipes();

      setTimeout(() => {
        setIsCreateRecipeModalOpen(false);
        setRecipeSuccess('');
      }, 1500);
    } catch (err) {
      setRecipeError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmittingRecipe(false);
    }
  };

  const filteredMenus = useMemo(() => {
    let filtered = [...menus];
    if (searchTerm.trim()) {
      filtered = filtered.filter((menu) =>
        menu.menu_name && menu.menu_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (activeCategory !== ALL_CATEGORY) {
      if (activeCategory === UNCATEGORIZED) {
        filtered = filtered.filter((menu) => !menu.category_id);
      } else {
        filtered = filtered.filter((menu) => menu.category_id === activeCategory);
      }
    }
    return filtered;
  }, [menus, searchTerm, activeCategory]);

  const filteredUserRecipes = useMemo(() => {
    if (!searchTerm.trim()) return userRecipes;
    return userRecipes.filter((recipe) =>
      recipe.cpost_title && recipe.cpost_title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [userRecipes, searchTerm]);

  const groupedMenus = useMemo(() => {
    const map = new Map();
    filteredMenus.forEach((menu) => {
      const key = menu.category_id || UNCATEGORIZED;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(menu);
    });
    return map;
  }, [filteredMenus]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-grow pt-24">
        <div className="container mx-auto px-6 sm:px-8 py-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">เมนูจากฐานข้อมูล</h1>
              <p className="text-sm text-gray-500 mt-1">เลือกหมวดหมู่หรือค้นหาเมนูที่คุณต้องการ</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex-1 md:w-64">
                <input
                  type="text"
                  placeholder="ค้นหาจากชื่อเมนู..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                {token && (
                  <button
                    onClick={() => setIsCreateRecipeModalOpen(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2 whitespace-nowrap"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    สร้างสูตรอาหาร
                  </button>
                )}
                {user?.isAdmin && (
                  <button
                    onClick={() => setIsAddMenuModalOpen(true)}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-full font-medium hover:bg-emerald-700 transition-colors shadow-lg flex items-center gap-2 whitespace-nowrap"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    เพิ่มเมนู
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 mb-4">
            <button
              onClick={() => setActiveCategory(ALL_CATEGORY)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                activeCategory === ALL_CATEGORY
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              ทั้งหมด ({menus.length})
            </button>
            {categories.map((category) => (
              <button
                key={category.category_id}
                onClick={() => setActiveCategory(category.category_id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  activeCategory === category.category_id
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {category.category_name}
                {groupedMenus.has(category.category_id) && (
                  <span className="ml-2 text-xs opacity-80">
                    ({groupedMenus.get(category.category_id).length})
                  </span>
                )}
              </button>
            ))}
            {groupedMenus.has(UNCATEGORIZED) && (
              <button
                onClick={() => setActiveCategory(UNCATEGORIZED)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  activeCategory === UNCATEGORIZED
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                หมวดหมู่ทั่วไป ({groupedMenus.get(UNCATEGORIZED).length})
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="text-center py-16 text-gray-500">กำลังโหลดข้อมูลเมนู...</div>
          ) : error ? (
            <div className="text-center py-16 text-red-500">{error}</div>
          ) : filteredMenus.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg text-gray-500 mb-4">
                {searchTerm ? 'ไม่พบเมนูที่ค้นหา' : 'ยังไม่มีเมนูในหมวดหมู่นี้'}
              </p>
              {!searchTerm && (
                <p className="text-sm text-gray-400">
                  กรุณาเพิ่มเมนูผ่านระบบหลังบ้าน แล้วลองอีกครั้ง
                </p>
              )}
            </div>
          ) : activeCategory !== ALL_CATEGORY ? (
            <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800">
                  {activeCategory === UNCATEGORIZED
                    ? 'หมวดหมู่ทั่วไป'
                    : categoryMap[activeCategory] || 'หมวดหมู่'}
                </h2>
                <p className="text-sm text-gray-500">{filteredMenus.length} เมนู</p>
              </div>
              <div className="px-5 py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredMenus.map((menu) => (
                    <MenuCard
                      key={menu.menu_id}
                      menu={menu}
                      categoryName={
                        activeCategory === UNCATEGORIZED
                          ? 'หมวดหมู่ทั่วไป'
                          : categoryMap[activeCategory] || 'หมวดหมู่'
                      }
                      token={token}
                      user={user}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden mb-6">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-800">เมนูทั้งหมด</h2>
                  <p className="text-sm text-gray-500">{filteredMenus.length} เมนู</p>
                </div>
                <div className="px-5 py-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredMenus.map((menu) => (
                      <MenuCard
                        key={menu.menu_id}
                        menu={menu}
                        categoryName={categoryMap[menu.category_id] || 'หมวดหมู่ทั่วไป'}
                        token={token}
                        user={user}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {!loadingRecipes && (
                <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800">สูตรอาหารจากผู้ใช้</h2>
                    <p className="text-sm text-gray-500">
                      {loadingRecipes ? 'กำลังโหลด...' : `${filteredUserRecipes.length} สูตร`}
                    </p>
                  </div>
                  <div className="px-5 py-6">
                    {loadingRecipes ? (
                      <div className="text-center py-8 text-gray-500">กำลังโหลดสูตรอาหาร...</div>
                    ) : filteredUserRecipes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>ยังไม่มีสูตรอาหารจากผู้ใช้</p>
                        <p className="text-sm text-gray-400 mt-2">สร้างสูตรอาหารใหม่ได้ที่หน้า Community</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredUserRecipes.map((recipe) => (
                          <RecipeCard
                            key={recipe.recipe_id || recipe.cpost_id}
                            recipe={recipe}
                            token={token}
                            user={user}
                            onDelete={handleDeleteRecipe}
                            onReport={handleReportRecipe}
                            recipeRef={(el) => {
                              if (el) recipeRefs.current[recipe.recipe_id] = el;
                            }}
                            isHighlighted={highlightedRecipeId === recipe.recipe_id}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <AddMenuModal
        isOpen={isAddMenuModalOpen}
        onClose={() => setIsAddMenuModalOpen(false)}
        onSuccess={handleAddMenuSuccess}
        token={token}
        categories={categories}
      />

      {/* Create Recipe Modal */}
      {isCreateRecipeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-800">สร้างสูตรอาหาร</h2>
              <button
                onClick={() => {
                  setIsCreateRecipeModalOpen(false);
                  resetRecipeForm();
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateRecipe} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสูตรอาหาร *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={recipeTitle}
                    onChange={(e) => setRecipeTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย / สรุปสูตร</label>
                  <textarea
                    rows="3"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={recipeSummary}
                    onChange={(e) => setRecipeSummary(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                  <input
                    type="text"
                    placeholder="เช่น อาหารเช้า, เมนูสุขภาพ"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={recipeCategory}
                    onChange={(e) => setRecipeCategory(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเสิร์ฟ</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเตรียม (นาที)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เวลาปรุง (นาที)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={cookTime}
                    onChange={(e) => setCookTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เวลารวม (นาที)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={totalTime}
                    onChange={(e) => setTotalTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รูปภาพประกอบ</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files[0] || null)}
                    className="w-full text-sm text-gray-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">รายการวัตถุดิบ *</h3>
                  <button type="button" onClick={addIngredient} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200">
                    + เพิ่มวัตถุดิบ
                  </button>
                </div>
                <div className="space-y-3">
                  {ingredients.map((ingredient, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center bg-gray-50 p-3 rounded-lg">
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          value={ingredient.name}
                          onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="ชื่อวัตถุดิบ"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={ingredient.amount}
                          onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="ปริมาณ / หน่วย"
                        />
                      </div>
                      {ingredients.length > 1 && (
                        <div className="md:col-span-5 flex justify-end">
                          <button type="button" onClick={() => removeIngredient(index)} className="text-sm text-red-500 hover:underline">
                            ลบ
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">ขั้นตอนการทำ *</h3>
                  <button type="button" onClick={addStep} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200">
                    + เพิ่มขั้นตอน
                  </button>
                </div>
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-700">ขั้นตอนที่ {index + 1}</h4>
                        {steps.length > 1 && (
                          <button type="button" onClick={() => removeStep(index)} className="text-sm text-red-500 hover:underline">
                            ลบ
                          </button>
                        )}
                      </div>
                      <textarea
                        rows="3"
                        value={step.detail}
                        onChange={(e) => updateStep(index, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="อธิบายขั้นตอนการทำอาหาร"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {recipeError && (
                <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {recipeError}
                </div>
              )}
              {recipeSuccess && (
                <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm">
                  {recipeSuccess}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateRecipeModalOpen(false);
                    resetRecipeForm();
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-full hover:bg-gray-50"
                  disabled={submittingRecipe}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submittingRecipe}
                  className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50"
                >
                  {submittingRecipe ? 'กำลังบันทึก...' : 'สร้างสูตรอาหาร'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedRecipeId(null);
        }}
        onConfirm={confirmDeleteRecipe}
        title="คุณแน่ใจหรือไม่ว่าต้องการลบสูตรอาหารนี้?"
      />

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setSelectedRecipeId(null);
        }}
        recipeId={selectedRecipeId}
        onReportSubmitted={() => {
          setIsReportModalOpen(false);
          setSelectedRecipeId(null);
        }}
      />
    </div>
  );
}

export default MenuPage;