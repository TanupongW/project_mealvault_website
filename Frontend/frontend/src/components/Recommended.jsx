import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { API_URL, IMAGE_URL } from '../config/api';
import { AuthContext } from '../context/AuthContext';

// Component สำหรับการ์ดเมนูแต่ละอัน (ใช้ข้อมูลจากฐานข้อมูลของเรา)
function RecipeCard({ menu }) {
  if (!menu) return null;

  const imageSrc = menu.menu_image
    ? (menu.menu_image.startsWith('http') ? menu.menu_image : `${IMAGE_URL}/${menu.menu_image}`)
    : 'https://via.placeholder.com/400x260.png?text=MealVault';

  return (
    <Link
      to={`/menus/${menu.menu_id}`}
      className="w-full h-full block group relative overflow-hidden rounded-xl shadow-lg"
    >
      <img
        src={imageSrc}
        alt={menu.menu_name}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
      <div className="absolute bottom-0 left-0 p-4 text-white">
        <h3 className="font-bold text-lg mb-1 line-clamp-1">{menu.menu_name}</h3>
        {typeof menu.menu_like_count === 'number' && (
          <p className="text-sm opacity-90 bg-green-500 px-3 py-1 rounded-full inline-block">
            ❤ {menu.menu_like_count} ไลก์
          </p>
        )}
      </div>
    </Link>
  );
}

function Recommended() {
  const [recommendedMenus, setRecommendedMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const { token } = useContext(AuthContext);

  const ITEMS_PER_PAGE = 3;
  const MAX_ITEMS = 12;

  // ผสมเมนูยอดไลค์สูงกับเมนูที่ไลค์น้อย/ยังไม่มีคนไลค์ให้มีโอกาสแสดงมากขึ้น
  const mixPopularAndLessLiked = (menus) => {
    if (!Array.isArray(menus) || menus.length === 0) return [];

    const withLikeCount = menus.map((m) => ({
      ...m,
      _like: typeof m.menu_like_count === 'number' ? m.menu_like_count : 0,
    }));

    // เรียงจากไลค์มากไปน้อยก่อน เพื่อดึงกลุ่มยอดนิยม
    const sorted = withLikeCount.sort((a, b) => b._like - a._like);

    const popularCount = Math.min(6, sorted.length);
    const popular = sorted.slice(0, popularCount);
    const others = sorted.slice(popularCount);

    // สุ่มเมนูที่เหลือ (รวมถึงเมนูไลค์น้อย/ศูนย์ไลค์)
    const shuffledOthers = [...others].sort(() => Math.random() - 0.5);
    const remainingSlots = Math.max(0, MAX_ITEMS - popular.length);
    const pickedOthers = shuffledOthers.slice(0, remainingSlots);

    return [...popular, ...pickedOthers].map(({ _like, ...rest }) => rest);
  };

  useEffect(() => {
    const fetchRecommendedMenus = async () => {
      setLoading(true);
      setError('');
      try {
        if (token) {
          let aiList = []; // ประกาศไว้ข้างนอก try block
          
          // 1) พยายามใช้เมนูจาก AI (เลือกจากเมนูในฐานข้อมูลเท่านั้น)
          try {
            console.log('🔍 [Recommended] Calling /api/ai/recommendations...');
            const aiResp = await fetch(`${API_URL}/ai/recommendations`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            console.log('🔍 [Recommended] AI Response status:', aiResp.status, aiResp.statusText);

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              console.log('🔍 [Recommended] AI Response data:', aiData);
              console.log('🔍 [Recommended] Recommendations array:', aiData.recommendations);
              
              if (Array.isArray(aiData.recommendations)) {
                // Debug: ดูแต่ละ item
                aiData.recommendations.forEach((item, index) => {
                  console.log(`🔍 [Recommended] Item ${index}:`, item, 'has menu_id?', !!item?.menu_id);
                });
                
                aiList = aiData.recommendations.filter((item) => {
                  const hasMenuId = item && item.menu_id;
                  if (!hasMenuId) {
                    console.warn('⚠️ [Recommended] Item without menu_id:', item);
                  }
                  return hasMenuId;
                });
              } else {
                aiList = [];
              }

              console.log('🔍 [Recommended] AI List length after filter:', aiList.length);

              // ถ้า AI/ML ให้ผลมา 5 ตัวขึ้นไป ใช้เลย
              if (aiList.length >= 5) {
                console.log('✅ [Recommended] Using AI recommendations:', aiList.length, 'items');
                setRecommendedMenus(aiList);
                return;
              }
              // ถ้าน้อยกว่า 5 ให้เก็บไว้แล้วไปเติมจาก fallback ด้านล่าง
            } else {
              console.warn('⚠️ [Recommended] AI Response not OK:', aiResp.status, await aiResp.text());
            }
          } catch (aiError) {
            console.error('❌ [Recommended] AI recommendations failed:', aiError);
            aiList = []; // Reset ถ้า error
          }

          // 2) ถ้า AI ใช้ไม่ได้ หรือมีผลน้อย ให้ใช้เมนูที่ผู้ใช้กดไลค์ + เมนูใหม่ๆ จากฐานข้อมูล
          console.log('🔍 [Recommended] Calling /api/menus/recommended-liked...');
          const response = await fetch(`${API_URL}/menus/recommended-liked`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          
          console.log('🔍 [Recommended] Recommended-liked status:', response.status);

          if (!response.ok) {
            // ถ้า token หมดอายุหรือไม่ได้รับอนุญาต ให้ fallback ไปใช้ /menus แบบ public
            if (response.status === 401 || response.status === 403) {
              throw new Error('unauthorized');
            }
            throw new Error('failed');
          }

          const data = await response.json();
          const rawList = Array.isArray(data) ? data : [];
          
          // ถ้า AI ให้ผลมาน้อยกว่า 5 ให้รวมกับ fallback
          let finalList = rawList;
          if (aiList && aiList.length > 0 && aiList.length < 5) {
            const aiIds = new Set(aiList.map(m => m.menu_id));
            const additional = rawList.filter(m => !aiIds.has(m.menu_id));
            finalList = [...aiList, ...additional].slice(0, 12);
          }
          
          const list = mixPopularAndLessLiked(finalList);

          // ถ้าจาก liked ว่าง ให้ fallback ไปใช้ /menus
          if (!list.length) {
            throw new Error('empty');
          }

          setRecommendedMenus(list);
        } else {
          // ถ้ายังไม่ล็อกอิน: ใช้เมนูจากฐานข้อมูล แล้วผสมเมนูไลค์เยอะกับไลค์น้อย
          const fallbackResp = await fetch(`${API_URL}/menus`);
          const fallbackData = await fallbackResp.json();
          const allMenus = Array.isArray(fallbackData) ? fallbackData : [];

          const mixed = mixPopularAndLessLiked(allMenus);
          setRecommendedMenus(mixed);
        }
      } catch (error) {
        console.error('Failed to fetch recommended menus:', error);
        // Fallback สุดท้าย: ลองดึงจาก /menus อีกครั้ง
        try {
          const resp = await fetch(`${API_URL}/menus`);
          const data = await resp.json();
          const allMenus = Array.isArray(data) ? data : [];
          const mixed = mixPopularAndLessLiked(allMenus);

          setRecommendedMenus(mixed);
          if (!mixed.length) {
            setError('ยังไม่มีเมนูแนะนำจากฐานข้อมูล');
          }
        } catch (fallbackError) {
          console.error('Fallback fetch menus failed:', fallbackError);
          setRecommendedMenus([]);
          setError('ไม่สามารถโหลดเมนูแนะนำได้');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendedMenus();
  }, [token]);

  useEffect(() => {
    if (recommendedMenus.length > ITEMS_PER_PAGE) {
      const timer = setTimeout(() => {
        paginate(1);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [page, recommendedMenus]);

  const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { zIndex: 1, x: 0, opacity: 1 },
    exit: (direction) => ({ zIndex: 0, x: direction < 0 ? '100%' : '-100%', opacity: 0 }),
  };
  
  const totalPages = Math.ceil(recommendedMenus.length / ITEMS_PER_PAGE);

  const paginate = (newDirection) => {
    setDirection(newDirection);
    setPage((prevPage) => {
        let nextPage = prevPage + newDirection;
        if (nextPage < 0) return totalPages - 1;
        if (nextPage >= totalPages) return 0;
        return nextPage;
    });
  };
  
  if (loading) {
    return (
      <section className="py-8">
        <h2 className="text-3xl font-bold mb-8 text-center md:text-left">เมนูแนะนำ</h2>
        <div className="relative w-full h-64 flex items-center justify-center bg-gray-100 rounded-xl"><p>กำลังโหลดเมนูแนะนำ...</p></div>
      </section>
    );
  }

  return (
    <section className="py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-1 h-10 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full"></div>
          <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            เมนูแนะนำ
          </h2>
        </div>
        <div className="flex space-x-2">
           <button onClick={() => paginate(-1)} className="bg-white text-green-600 p-3 rounded-full shadow-lg hover:bg-green-50 hover:shadow-xl transition-all transform hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => paginate(1)} className="bg-white text-green-600 p-3 rounded-full shadow-lg hover:bg-green-50 hover:shadow-xl transition-all transform hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      
      <div className="relative w-full mx-auto h-64 overflow-hidden rounded-2xl shadow-xl bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
        {recommendedMenus.length === 0 ? (
          <p className="text-gray-400 text-sm">
            {error || 'ยังไม่มีเมนูแนะนำในขณะนี้'}
          </p>
        ) : (
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={page}
              className="absolute w-full h-full grid grid-cols-1 md:grid-cols-3 gap-8"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
            >
              {recommendedMenus
                .slice(page * ITEMS_PER_PAGE, (page * ITEMS_PER_PAGE) + ITEMS_PER_PAGE)
                .map(menu => (
                  <RecipeCard key={menu.menu_id} menu={menu} />
                ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

export default Recommended;
