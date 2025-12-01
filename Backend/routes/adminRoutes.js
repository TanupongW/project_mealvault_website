const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

// --- Middleware: สำหรับตรวจสอบสิทธิ์ความเป็น Admin ---
const checkAdmin = async (req, res, next) => {
  try {
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
    next(); // ถ้าเป็น Admin ให้ไปต่อ
  } catch (error) {
    console.error('Error in checkAdmin middleware:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' });
  }
};

// --- Admin Routes ---
// ทุก Route ในไฟล์นี้จะถูกป้องกันด้วย authMiddleware และ checkAdmin

// GET /api/admin/reports - ดึงข้อมูลรายงานทั้งหมด
router.get('/admin/reports', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { data: reports, error } = await supabase
      .from('CommunityReport')
      .select('creport_id, creport_reason, creport_datetime, cpost_id, user_id')
      .order('creport_datetime', { ascending: false });
    if (error) throw error;
    res.json(reports || []);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน' });
  }
});

// GET /api/admin/users - ดึงข้อมูลผู้ใช้ทั้งหมดพร้อมฟังก์ชันค้นหา
router.get('/admin/users', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    
    // ดึงข้อมูลผู้ใช้ทั้งหมด (รวม is_active ถ้ามี)
    let query = supabase
      .from('User')
      .select('user_id, user_email, user_fname, user_lname, user_tel, calorie_limit, allergies, favorite_foods, created_at, updated_at, is_active')
      .order('created_at', { ascending: false });

    const { data: users, error } = await query;
    if (error) throw error;

    // กรองข้อมูลบน backend ถ้ามีการค้นหา
    let filteredUsers = users || [];
    if (search && search.trim() !== '') {
      const searchTerm = search.trim().toLowerCase();
      filteredUsers = filteredUsers.filter(user => {
        return (
          user.user_email?.toLowerCase().includes(searchTerm) ||
          user.user_fname?.toLowerCase().includes(searchTerm) ||
          user.user_lname?.toLowerCase().includes(searchTerm) ||
          user.user_id?.toLowerCase().includes(searchTerm) ||
          user.user_tel?.includes(searchTerm)
        );
      });
    }

    // ตรวจสอบว่าแต่ละ user เป็น admin หรือไม่ และดึงข้อมูลการค้นหา + สถิติ
    const usersWithAdminStatus = await Promise.all(
      filteredUsers.map(async (user) => {
        const { data: adminCheck } = await supabase
          .from('Admin')
          .select('admin_id')
          .eq('admin_id', user.user_id)
          .limit(1);
        
        // ดึงข้อมูลการค้นหาทั้งหมดของผู้ใช้
        const { data: allSearches } = await supabase
          .from('UserSearchHistory')
          .select('search_query')
          .eq('user_id', user.user_id);
        
        // นับจำนวนครั้งที่ค้นหาแต่ละคำ
        const searchCounts = {};
        if (allSearches && allSearches.length > 0) {
          allSearches.forEach(search => {
            const query = search.search_query ? search.search_query.toLowerCase().trim() : '';
            if (query) {
              searchCounts[query] = (searchCounts[query] || 0) + 1;
            }
          });
        }
        
        // หาคำที่ค้นหาบ่อยที่สุด
        const mostSearched = Object.keys(searchCounts).length > 0
          ? Object.entries(searchCounts)
              .sort((a, b) => b[1] - a[1])[0][0]
          : null;
        
        // ดึงการค้นหาล่าสุด 5 รายการ
        const { data: recentSearches } = await supabase
          .from('UserSearchHistory')
          .select('search_query, search_type, created_at')
          .eq('user_id', user.user_id)
          .order('created_at', { ascending: false })
          .limit(5);
        
        // นับสถิติผู้ใช้
        const [postsResult, recipesResult, commentsResult, postLikesResult, menuLikesResult] = await Promise.all([
          supabase.from('CommunityPost').select('cpost_id').eq('user_id', user.user_id).eq('post_type', 'post'),
          supabase.from('UserRecipe').select('recipe_id').eq('user_id', user.user_id),
          supabase.from('CommunityComment').select('comment_id').eq('user_id', user.user_id),
          supabase.from('PostLike').select('id').eq('user_id', user.user_id),
          supabase.from('MenuLike').select('id').eq('user_id', user.user_id)
        ]);
        
        return {
          ...user,
          isAdmin: !!(adminCheck && adminCheck.length > 0),
          is_active: user.is_active !== undefined ? user.is_active : true, // default true
          topSearches: recentSearches || [],
          mostSearched: mostSearched,
          searchCount: allSearches ? allSearches.length : 0,
          stats: {
            posts: postsResult.data ? postsResult.data.length : 0,
            recipes: recipesResult.data ? recipesResult.data.length : 0,
            comments: commentsResult.data ? commentsResult.data.length : 0,
            postLikes: postLikesResult.data ? postLikesResult.data.length : 0,
            menuLikes: menuLikesResult.data ? menuLikesResult.data.length : 0,
            totalLikes: (postLikesResult.data ? postLikesResult.data.length : 0) + (menuLikesResult.data ? menuLikesResult.data.length : 0)
          }
        };
      })
    );

    res.json(usersWithAdminStatus || []);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' });
  }
});

// DELETE /api/admin/posts/:id - ลบโพสต์โดย Admin
router.delete('/admin/posts/:id', authMiddleware, checkAdmin, async (req, res) => {
    try {
      const { id: postId } = req.params;

      const { error: delCommentsErr } = await supabase
        .from('CommunityComment')
        .delete()
        .eq('cpost_id', postId);
      if (delCommentsErr) throw delCommentsErr;

      const { error: delLikesErr } = await supabase
        .from('PostLike')
        .delete()
        .eq('post_id', postId);
      if (delLikesErr) throw delLikesErr;

      const { error: delPostErr } = await supabase
        .from('CommunityPost')
        .delete()
        .eq('cpost_id', postId);
      if (delPostErr) throw delPostErr;

      res.json({ message: 'ลบโพสต์สำเร็จ' });
    } catch (error) {
      console.error('Error deleting post by admin:', error);
      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบโพสต์' });
    }
});

// DELETE /api/admin/comments/:id - ลบคอมเมนต์โดย Admin
router.delete('/admin/comments/:id', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { id: commentId } = req.params;
    const { error } = await supabase
      .from('CommunityComment')
      .delete()
      .eq('comment_id', commentId);
    if (error) throw error;
    res.json({ message: 'ลบความคิดเห็นสำเร็จ' });
  } catch (error) {
    console.error('Error deleting comment by admin:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบความคิดเห็น' });
  }
});

// PUT /api/admin/users/:id - แก้ไขข้อมูลผู้ใช้โดย Admin
router.put('/admin/users/:id', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { id: userId } = req.params;
    const { user_email, user_fname, user_lname, user_tel, calorie_limit, allergies, favorite_foods, is_active } = req.body;

    // สร้าง object สำหรับอัปเดต (เฉพาะฟิลด์ที่มีค่า)
    const updateData = {};
    if (user_email !== undefined) updateData.user_email = user_email;
    if (user_fname !== undefined) updateData.user_fname = user_fname;
    if (user_lname !== undefined) updateData.user_lname = user_lname;
    if (user_tel !== undefined) updateData.user_tel = user_tel;
    if (calorie_limit !== undefined) updateData.calorie_limit = calorie_limit;
    if (allergies !== undefined) updateData.allergies = allergies;
    if (favorite_foods !== undefined) updateData.favorite_foods = favorite_foods;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('User')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'อัปเดตข้อมูลผู้ใช้สำเร็จ', user: data });
  } catch (error) {
    console.error('Error updating user by admin:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ใช้' });
  }
});

// PUT /api/admin/users/:id/password - เปลี่ยนรหัสผ่านให้ผู้ใช้โดย Admin
router.put('/admin/users/:id/password', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { id: userId } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }

    // Hash รหัสผ่านใหม่
    const hashedPassword = await bcrypt.hash(new_password, 10);

    const { data, error } = await supabase
      .from('User')
      .update({ 
        user_password: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('user_id, user_email')
      .single();

    if (error) throw error;

    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ', user: data });
  } catch (error) {
    console.error('Error changing user password by admin:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' });
  }
});

// PUT /api/admin/users/:id/toggle-active - ระงับ/เปิดใช้งานบัญชีผู้ใช้
router.put('/admin/users/:id/toggle-active', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { id: userId } = req.params;
    const adminId = req.user.id;

    if (adminId === userId) {
      return res.status(400).json({ message: 'ไม่สามารถระงับบัญชีตัวเองได้' });
    }

    // ดึงข้อมูลผู้ใช้ปัจจุบัน
    const { data: currentUser, error: fetchError } = await supabase
      .from('User')
      .select('is_active')
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    const newActiveStatus = currentUser.is_active === false ? true : false;

    const { data, error } = await supabase
      .from('User')
      .update({ 
        is_active: newActiveStatus,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('user_id, user_email, is_active')
      .single();

    if (error) throw error;

    res.json({ 
      message: newActiveStatus ? 'เปิดใช้งานบัญชีสำเร็จ' : 'ระงับบัญชีสำเร็จ',
      user: data 
    });
  } catch (error) {
    console.error('Error toggling user active status:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะบัญชี' });
  }
});

// GET /api/admin/users/:id/details - ดึงรายละเอียดผู้ใช้แบบละเอียด
router.get('/admin/users/:id/details', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { id: userId } = req.params;

    // ดึงข้อมูลผู้ใช้
    const { data: userData, error: userError } = await supabase
      .from('User')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userError) throw userError;

    // ดึงข้อมูลทั้งหมดแบบ parallel
    const [
      posts,
      recipes,
      comments,
      postLikes,
      menuLikes,
      searches,
      menuViews
    ] = await Promise.all([
      supabase.from('CommunityPost').select('cpost_id, cpost_title, cpost_datetime, like_count').eq('user_id', userId).eq('post_type', 'post').order('cpost_datetime', { ascending: false }),
      supabase.from('UserRecipe').select('recipe_id, recipe_title, created_at, like_count').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('CommunityComment').select('comment_id, comment_text, comment_datetime, cpost_id').eq('user_id', userId).order('comment_datetime', { ascending: false }),
      supabase.from('PostLike').select('id, post_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('MenuLike').select('id, menu_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('UserSearchHistory').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('UserMenuView').select('menu_id, view_count, last_viewed_at').eq('user_id', userId).order('last_viewed_at', { ascending: false })
    ]);

    // ตรวจสอบว่าเป็น admin หรือไม่
    const { data: adminCheck } = await supabase
      .from('Admin')
      .select('admin_id')
      .eq('admin_id', userId)
      .limit(1);

    res.json({
      user: {
        ...userData,
        isAdmin: !!(adminCheck && adminCheck.length > 0)
      },
      posts: posts.data || [],
      recipes: recipes.data || [],
      comments: comments.data || [],
      postLikes: postLikes.data || [],
      menuLikes: menuLikes.data || [],
      searches: searches.data || [],
      menuViews: menuViews.data || []
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายละเอียดผู้ใช้' });
  }
});

// POST /api/admin/users/bulk-action - Bulk actions สำหรับผู้ใช้
router.post('/admin/users/bulk-action', authMiddleware, checkAdmin, async (req, res) => {
  try {
    const { action, user_ids } = req.body;
    const adminId = req.user.id;

    if (!action || !user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ message: 'กรุณาระบุ action และ user_ids' });
    }

    // ตรวจสอบว่าไม่รวม admin ตัวเอง
    const filteredUserIds = user_ids.filter(id => id !== adminId);

    if (filteredUserIds.length === 0) {
      return res.status(400).json({ message: 'ไม่สามารถดำเนินการกับบัญชีตัวเองได้' });
    }

    let result;
    switch (action) {
      case 'delete':
        const { error: deleteError } = await supabase
          .from('User')
          .delete()
          .in('user_id', filteredUserIds);
        if (deleteError) throw deleteError;
        result = { message: `ลบผู้ใช้ ${filteredUserIds.length} รายการสำเร็จ` };
        break;

      case 'deactivate':
        const { error: deactivateError } = await supabase
          .from('User')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('user_id', filteredUserIds);
        if (deactivateError) throw deactivateError;
        result = { message: `ระงับบัญชี ${filteredUserIds.length} รายการสำเร็จ` };
        break;

      case 'activate':
        const { error: activateError } = await supabase
          .from('User')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .in('user_id', filteredUserIds);
        if (activateError) throw activateError;
        result = { message: `เปิดใช้งานบัญชี ${filteredUserIds.length} รายการสำเร็จ` };
        break;

      default:
        return res.status(400).json({ message: 'Action ไม่ถูกต้อง' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดำเนินการ' });
  }
});

// DELETE /api/admin/users/:id - ลบผู้ใช้โดย Admin
router.delete('/admin/users/:id', authMiddleware, checkAdmin, async (req, res) => {
    try {
        const adminId = req.user.id;
        const { id: userIdToDelete } = req.params;

        if (adminId === userIdToDelete) {
          return res.status(400).json({ message: 'ผู้ดูแลระบบไม่สามารถลบตัวเองได้' });
        }

        const { error } = await supabase
          .from('User')
          .delete()
          .eq('user_id', userIdToDelete);
        if (error) throw error;

        res.json({ message: 'ลบผู้ใช้สำเร็จ' });
    } catch (error) {
        console.error('Error deleting user by admin:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบผู้ใช้' });
    }
});


module.exports = router;