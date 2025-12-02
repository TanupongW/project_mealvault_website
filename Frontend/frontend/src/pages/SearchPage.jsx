import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { API_URL, IMAGE_URL } from '../config/api';

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

function MenuCard({ menu, token }) {
  const navigate = useNavigate();
  const imageSrc = menu.menu_image
    ? (menu.menu_image.startsWith('http') ? menu.menu_image : `${IMAGE_URL}${menu.menu_image}`)
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
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/400x260.png?text=MealVault';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
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
            onClick={() => navigate(`/menus/${menu.menu_id}`)}
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

function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const { token, user } = useContext(AuthContext);

  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }
    
    const fetchMenus = async () => {
      setLoading(true);
      try {
        // ค้นหาจาก Database ของเรา
        const response = await fetch(`${API_URL}/menus/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        const resultCount = Array.isArray(data) ? data.length : 0;
        setMenus(Array.isArray(data) ? data : []);
        
        // Track search behavior
        if (token) {
          try {
            await fetch(`${API_URL}/behavior/search`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                search_query: query,
                search_type: 'ingredient',
                result_count: resultCount,
                user_id: user?.user_id
              })
            });
          } catch (trackError) {
            console.error("Failed to track search:", trackError);
          }
        }
      } catch (error) {
        console.error("Failed to fetch menus:", error);
        setMenus([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMenus();
  }, [query, token, user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col">
      <Navbar />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-6 sm:px-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Link 
                to="/"
                className="p-2 rounded-full hover:bg-white transition-colors"
                title="กลับหน้าหลัก"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                ผลการค้นหา: "{query}"
              </h1>
            </div>
            <p className="text-gray-600 ml-14">พบ {menus.length} เมนูจากระบบของเรา</p>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
                <p className="text-gray-600">กำลังค้นหาเมนู...</p>
              </div>
            </div>
          ) : (
            <>
              {menus.length > 0 ? (
                <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
                  <div className="px-5 py-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {menus.map(menu => (
                        <MenuCard
                          key={menu.menu_id}
                          menu={menu}
                          token={token}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">ไม่พบเมนูที่ค้นหา</h3>
                  <p className="text-lg text-gray-500 mb-6">ลองค้นหาด้วยคำอื่น หรือดูเมนูทั้งหมดของเรา</p>
                  <div className="flex gap-4 justify-center">
                    <Link 
                      to="/" 
                      className="inline-block px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-full hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg"
                    >
                      กลับหน้าหลัก
                    </Link>
                    <Link 
                      to="/menus" 
                      className="inline-block px-6 py-3 bg-white text-green-600 font-semibold rounded-full border-2 border-green-500 hover:bg-green-50 transition-all duration-300"
                    >
                      ดูเมนูทั้งหมด
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default SearchPage;