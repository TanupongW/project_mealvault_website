const authMiddleware = require('../middleware/authMiddleware'); 
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');


// สร้าง API Endpoint สำหรับค้นหาเมนูอาหาร
// GET /api/menus/search?q=keyword
router.get('/menus/search', async (req, res) => {
  try {
    // 1. ดึงคำค้นหา (keyword) จาก query string ของ URL
    const { q } = req.query;

    // ตรวจสอบว่ามีคำค้นหาหรือไม่
    if (!q) {
      return res.status(400).json({ message: 'กรุณาระบุคำค้นหา' });
    }

    // 2. สร้างคำค้นหาสำหรับ SQL โดยใช้ LIKE และเครื่องหมาย %
    // เครื่องหมาย % หมายถึง "ตัวอักษรอะไรก็ได้ จำนวนเท่าไหร่ก็ได้"
    // ดังนั้น '%ไข่%' จะหมายถึง ค้นหาคำที่มี "ไข่" อยู่ตรงไหนก็ได้ในชื่อ
    const searchTerm = `%${q}%`;
    const { data: menus, error } = await supabase
      .from('Menu')
      .select('*')
      .ilike('menu_name', searchTerm);
    if (error) throw error;
    res.json(menus || []);

  } catch (error) {
    console.error('Error searching menus:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการค้นหาเมนู' });
  }
});


// ... (โค้ดของ router.get('/menus',...)) และอื่นๆ ที่มีอยู่แล้ว ...
// สร้าง API Endpoint สำหรับดึงข้อมูลเมนูทั้งหมด
// GET /api/menus (ทุกคนสามารถดูได้)
router.get('/menus', async (req, res) => {
  try {
    const { data: menus, error } = await supabase
      .from('Menu')
      .select('*')
      .order('menu_datetime', { ascending: false });
    if (error) throw error;
    res.json(menus || []);
  } catch (error) {
    console.error('Error fetching menus:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเมนู' });
  }
});

// สร้าง API Endpoint สำหรับเพิ่มเมนูใหม่ (เฉพาะ Admin)
// POST /api/menus
router.post('/menus', authMiddleware, async (req, res) => {
  try {
    // 1. ตรวจสอบสิทธิ์ Admin
    // ดึง user_id จาก Token ที่ผ่าน middleware มาแล้ว
    const adminId = req.user.id; 
    const { data: admins, error: adminErr } = await supabase
      .from('Admin')
      .select('*')
      .eq('admin_id', adminId)
      .limit(1);
    if (adminErr) throw adminErr;
    if (!admins || admins.length === 0) {
      return res.status(403).json({ message: 'การเข้าถึงถูกปฏิเสธ: เฉพาะผู้ดูแลระบบเท่านั้น' });
    }

    // 2. ถ้าเป็น Admin ให้ทำการเพิ่มเมนูใหม่
    const { menu_name, menu_description, menu_recipe, menu_image, category_id, menu_source, menu_source_url } = req.body;

    if (!menu_name || !menu_description || !menu_recipe) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลเมนูให้ครบถ้วน' });
    }

    const newMenu = {
      menu_id: 'M' + Date.now().toString().slice(-6), // สร้าง ID เมนูชั่วคราว
      menu_name,
      menu_description,
      menu_recipe,
      menu_image: menu_image || 'default.jpg', // ใส่รูปภาพ default ถ้าไม่มี
      menu_datetime: new Date(),
      user_id: adminId, // บันทึกว่า Admin คนไหนเป็นคนสร้าง
      category_id,
      menu_source: menu_source || null,
      menu_source_url: menu_source_url || null
    };

    const { error } = await supabase.from('Menu').insert([newMenu]);
    if (error) throw error;

    res.status(201).json({ message: 'เพิ่มเมนูใหม่สำเร็จ' });

  } catch (error) {
    console.error('Error creating menu:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างเมนู' });
  }
});

// สร้าง API Endpoint สำหรับแก้ไขเมนู (เฉพาะ Admin)
// PUT /api/menus/:id
router.put('/menus/:id', authMiddleware, async (req, res) => {
  try {
    // 1. ตรวจสอบสิทธิ์ Admin (เหมือนเดิม)
    const adminId = req.user.id;
    const { data: admins, error: adminErr } = await supabase
      .from('Admin')
      .select('*')
      .eq('admin_id', adminId)
      .limit(1);
    if (adminErr) throw adminErr;
    if (!admins || admins.length === 0) {
      return res.status(403).json({ message: 'การเข้าถึงถูกปฏิเสธ: เฉพาะผู้ดูแลระบบเท่านั้น' });
    }

    // 2. ดึง ID ของเมนูที่จะแก้ไขจาก URL (params)
    const { id: menuId } = req.params;

    // 3. ดึงข้อมูลใหม่ที่จะอัปเดตจาก Request Body
    const { menu_name, menu_description, menu_recipe, menu_image, category_id, menu_source, menu_source_url } = req.body;

    if (!menu_name || !menu_description || !menu_recipe) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลเมนูที่จำเป็นให้ครบถ้วน' });
    }

    // 4. เขียนคำสั่ง SQL UPDATE
    const updateData = {
      menu_name,
      menu_description,
      menu_recipe,
      menu_image,
      category_id
    };
    
    // เพิ่ม source ถ้ามีการส่งมา
    if (menu_source !== undefined) updateData.menu_source = menu_source;
    if (menu_source_url !== undefined) updateData.menu_source_url = menu_source_url;

    const { data, error } = await supabase
      .from('Menu')
      .update(updateData)
      .eq('menu_id', menuId)
      .select();
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'ไม่พบเมนูที่ต้องการแก้ไข' });
    }

    res.json({ message: 'แก้ไขเมนูสำเร็จ' });

  } catch (error) {
    console.error('Error updating menu:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขเมนู' });
  }
});

// สร้าง API Endpoint สำหรับลบเมนู (เฉพาะ Admin)
// DELETE /api/menus/:id
router.delete('/menus/:id', authMiddleware, async (req, res) => {
  try {
    // 1. ตรวจสอบสิทธิ์ Admin (ใช้โค้ดชุดเดียวกับตอน POST และ PUT)
    const adminId = req.user.id;
    const { data: admins, error: adminErr } = await supabase
      .from('Admin')
      .select('*')
      .eq('admin_id', adminId)
      .limit(1);
    if (adminErr) throw adminErr;
    if (!admins || admins.length === 0) {
      return res.status(403).json({ message: 'การเข้าถึงถูกปฏิเสธ: เฉพาะผู้ดูแลระบบเท่านั้น' });
    }

    // 2. ดึง ID ของเมนูที่จะลบจาก URL (params)
    const { id: menuId } = req.params;

    // 3. เขียนคำสั่ง SQL DELETE
    const { error } = await supabase
      .from('Menu')
      .delete()
      .eq('menu_id', menuId);
    if (error) throw error;

    const result = { affectedRows: 1 };
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'ไม่พบเมนูที่ต้องการลบ' });
    }

    res.json({ message: 'ลบเมนูสำเร็จ' });

  } catch (error) {
    console.error('Error deleting menu:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบเมนู' });
  }
});

// --- Menu Like Routes ---

// GET /api/menus/:id/likes - สถานะการกดไลค์ของเมนู
router.get('/menus/:id/likes', authMiddleware, async (req, res) => {
  const { id: menuId } = req.params;
  const userId = req.user.id;

  try {
    const { data: menuData, error: menuErr } = await supabase
      .from('Menu')
      .select('menu_like_count')
      .eq('menu_id', menuId)
      .limit(1);
    if (menuErr) throw menuErr;
    if (!menuData || menuData.length === 0) {
      return res.status(404).json({ message: 'ไม่พบเมนู' });
    }

    const { data: likeData, error: likeErr } = await supabase
      .from('MenuLike')
      .select('id')
      .eq('menu_id', menuId)
      .eq('user_id', userId)
      .limit(1);
    if (likeErr) throw likeErr;

    res.json({
      like_count: menuData[0].menu_like_count || 0,
      liked: !!(likeData && likeData.length > 0)
    });
  } catch (error) {
    console.error('Error fetching menu likes:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไลค์เมนู' });
  }
});

// POST /api/menus/:id/like - toggle like
router.post('/menus/:id/like', authMiddleware, async (req, res) => {
  const { id: menuId } = req.params;
  const userId = req.user.id;

  try {
    const { data: existingLike, error: likeErr } = await supabase
      .from('MenuLike')
      .select('*')
      .eq('menu_id', menuId)
      .eq('user_id', userId)
      .limit(1);
    if (likeErr) throw likeErr;

    const { data: menuData, error: menuErr } = await supabase
      .from('Menu')
      .select('menu_like_count')
      .eq('menu_id', menuId)
      .limit(1);
    if (menuErr) throw menuErr;
    if (!menuData || menuData.length === 0) {
      return res.status(404).json({ message: 'ไม่พบเมนู' });
    }

    let newCount = menuData[0].menu_like_count || 0;
    let liked = false;

    if (existingLike && existingLike.length > 0) {
      const { error: deleteErr } = await supabase
        .from('MenuLike')
        .delete()
        .eq('menu_id', menuId)
        .eq('user_id', userId);
      if (deleteErr) throw deleteErr;
      newCount = Math.max(0, newCount - 1);
    } else {
      const { error: insertErr } = await supabase
        .from('MenuLike')
        .insert([{ menu_id: menuId, user_id: userId }]);
      if (insertErr) throw insertErr;
      newCount += 1;
      liked = true;
    }

    const { error: updateErr } = await supabase
      .from('Menu')
      .update({ menu_like_count: newCount })
      .eq('menu_id', menuId);
    if (updateErr) throw updateErr;

    res.json({ like_count: newCount, liked });
  } catch (error) {
    console.error('Error toggling menu like:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการกดไลค์เมนู' });
  }
});

// GET /api/menus/recommended-liked - เมนูแนะนำจากเมนูที่ผู้ใช้กดไลค์มากที่สุด
router.get('/menus/recommended-liked', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // ดึงรายการเมนูที่ผู้ใช้คนนี้เคยกดไลค์
    const { data: likes, error: likesErr } = await supabase
      .from('MenuLike')
      .select('menu_id')
      .eq('user_id', userId);

    if (likesErr) throw likesErr;

    let menus = [];

    if (likes && likes.length > 0) {
      const likedIds = likes.map(like => like.menu_id);

      const { data, error } = await supabase
        .from('Menu')
        .select('menu_id, menu_name, menu_image, menu_description, menu_like_count')
        .in('menu_id', likedIds)
        .order('menu_like_count', { ascending: false })
        .limit(12);

      if (error) throw error;
      menus = data || [];
    } else {
      // ถ้ายังไม่เคยกดไลค์เลย ให้แนะนำจากเมนูที่มียอดไลค์สูงสุดในระบบ
      const { data, error } = await supabase
        .from('Menu')
        .select('menu_id, menu_name, menu_image, menu_description, menu_like_count')
        .order('menu_like_count', { ascending: false })
        .limit(12);

      if (error) throw error;
      menus = data || [];
    }

    res.json(menus);
  } catch (error) {
    console.error('Error fetching recommended liked menus:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงเมนูแนะนำจากเมนูที่คุณกดไลค์' });
  }
});

module.exports = router;