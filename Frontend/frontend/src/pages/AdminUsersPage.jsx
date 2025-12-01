import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config/api';
import ConfirmationModal from '../components/ConfirmationModal';
import SuccessAnimation from '../components/SuccessAnimation';

function AdminUsersPage() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive, admin
  const [selectedUsers, setSelectedUsers] = useState([]);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [updating, setUpdating] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({ new_password: '', confirm_password: '' });
  const [isBulkActionModalOpen, setIsBulkActionModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState('');

  const isAdmin = user?.isAdmin || false;

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [token, isAdmin, navigate]);

  // กรองและเรียงลำดับข้อมูล
  useEffect(() => {
    let filtered = [...users];

    // กรองตาม search term
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(user => {
        return (
          user.user_email?.toLowerCase().includes(searchLower) ||
          user.user_fname?.toLowerCase().includes(searchLower) ||
          user.user_lname?.toLowerCase().includes(searchLower) ||
          user.user_id?.toLowerCase().includes(searchLower) ||
          user.user_tel?.includes(searchTerm)
        );
      });
    }

    // กรองตามสถานะ
    if (filterStatus === 'active') {
      filtered = filtered.filter(u => u.is_active !== false);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(u => u.is_active === false);
    } else if (filterStatus === 'admin') {
      filtered = filtered.filter(u => u.isAdmin);
    }

    // เรียงลำดับ
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'created_at':
          aVal = new Date(a.created_at || 0);
          bVal = new Date(b.created_at || 0);
          break;
        case 'posts':
          aVal = a.stats?.posts || 0;
          bVal = b.stats?.posts || 0;
          break;
        case 'recipes':
          aVal = a.stats?.recipes || 0;
          bVal = b.stats?.recipes || 0;
          break;
        case 'comments':
          aVal = a.stats?.comments || 0;
          bVal = b.stats?.comments || 0;
          break;
        case 'name':
          aVal = `${a.user_fname} ${a.user_lname || ''}`.toLowerCase();
          bVal = `${b.user_fname} ${b.user_lname || ''}`.toLowerCase();
          break;
        default:
          aVal = a[sortBy] || '';
          bVal = b[sortBy] || '';
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    setFilteredUsers(filtered);
  }, [searchTerm, sortBy, sortOrder, filterStatus, users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
          navigate('/');
          return;
        }
        throw new Error('ไม่สามารถดึงข้อมูลผู้ใช้ได้');
      }
      
      const data = await response.json();
      setUsers(data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (userItem) => {
    setUserToEdit(userItem);
    setEditFormData({
      user_email: userItem.user_email || '',
      user_fname: userItem.user_fname || '',
      user_lname: userItem.user_lname || '',
      user_tel: userItem.user_tel || '',
      calorie_limit: userItem.calorie_limit || '',
      allergies: userItem.allergies || '',
      favorite_foods: userItem.favorite_foods || '',
      is_active: userItem.is_active !== undefined ? userItem.is_active : true
    });
    setIsEditModalOpen(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const confirmEdit = async () => {
    if (!userToEdit) return;
    setUpdating(true);

    try {
      const response = await fetch(`${API_URL}/admin/users/${userToEdit.user_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...editFormData,
          calorie_limit: editFormData.calorie_limit ? parseInt(editFormData.calorie_limit) : null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้');
      }

      setIsEditModalOpen(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        fetchUsers();
      }, 2000);
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteClick = (userId, userEmail) => {
    setUserToDelete({ id: userId, email: userEmail });
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    setIsModalOpen(false);
    if (!userToDelete) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถลบผู้ใช้ได้');
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        fetchUsers();
      }, 2000);
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleViewDetails = async (userId) => {
    setLoadingDetails(true);
    setIsDetailModalOpen(true);
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('ไม่สามารถดึงรายละเอียดได้');
      
      const data = await response.json();
      setUserDetails(data);
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
      setIsDetailModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      alert('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (passwordData.new_password.length < 6) {
      alert('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`${API_URL}/admin/users/${userToEdit.user_id}/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_password: passwordData.new_password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
      }

      setIsPasswordModalOpen(false);
      setPasswordData({ new_password: '', confirm_password: '' });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleActive = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/toggle-active`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถเปลี่ยนสถานะได้');
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        fetchUsers();
      }, 2000);
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.user_id));
    }
  };

  const handleBulkAction = async () => {
    if (selectedUsers.length === 0) {
      alert('กรุณาเลือกผู้ใช้ที่ต้องการดำเนินการ');
      return;
    }

    setIsBulkActionModalOpen(false);
    setUpdating(true);

    try {
      const response = await fetch(`${API_URL}/admin/users/bulk-action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: bulkAction,
          user_ids: selectedUsers
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถดำเนินการได้');
      }

      setSelectedUsers([]);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        fetchUsers();
      }, 2000);
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['รหัสผู้ใช้', 'อีเมล', 'ชื่อ', 'นามสกุล', 'เบอร์โทร', 'แคลอรี่จำกัด', 'แพ้อาหาร', 'อาหารที่ชอบ', 'สถานะ', 'โพสต์', 'สูตรอาหาร', 'คอมเมนต์', 'ไลค์ทั้งหมด', 'วันที่สมัคร'];
    const rows = filteredUsers.map(u => [
      u.user_id,
      u.user_email,
      u.user_fname,
      u.user_lname || '',
      u.user_tel || '',
      u.calorie_limit || '',
      u.allergies || '',
      u.favorite_foods || '',
      u.isAdmin ? 'Admin' : (u.is_active === false ? 'ระงับ' : 'ใช้งาน'),
      u.stats?.posts || 0,
      u.stats?.recipes || 0,
      u.stats?.comments || 0,
      u.stats?.totalLikes || 0,
      u.created_at ? new Date(u.created_at).toLocaleDateString('th-TH') : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-grow pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">จัดการผู้ใช้</h1>
              <p className="text-gray-600">ดูและจัดการข้อมูลผู้ใช้ทั้งหมดในระบบ</p>
            </div>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📥 Export CSV
            </button>
          </div>

          {/* Filters and Controls */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6 space-y-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหาผู้ใช้ด้วยอีเมล, ชื่อ, นามสกุล, หรือรหัสผู้ใช้..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เรียงตาม</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="created_at">วันที่สมัคร</option>
                  <option value="name">ชื่อ</option>
                  <option value="posts">จำนวนโพสต์</option>
                  <option value="recipes">จำนวนสูตรอาหาร</option>
                  <option value="comments">จำนวนคอมเมนต์</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับ</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="desc">มาก → น้อย</option>
                  <option value="asc">น้อย → มาก</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">กรองตามสถานะ</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="active">ใช้งาน</option>
                  <option value="inactive">ระงับ</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-end">
                {selectedUsers.length > 0 && (
                  <div className="flex space-x-2 w-full">
                    <button
                      onClick={() => {
                        setBulkAction('deactivate');
                        setIsBulkActionModalOpen(true);
                      }}
                      className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                    >
                      ระงับ ({selectedUsers.length})
                    </button>
                    <button
                      onClick={() => {
                        setBulkAction('delete');
                        setIsBulkActionModalOpen(true);
                      }}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                    >
                      ลบ ({selectedUsers.length})
                    </button>
                  </div>
                )}
              </div>
            </div>

            {searchTerm && (
              <p className="text-sm text-gray-600">พบ {filteredUsers.length} รายการ</p>
            )}
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-600">ไม่พบข้อมูลผู้ใช้</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">รหัสผู้ใช้</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">อีเมล</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถิติ</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">การค้นหา</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่สมัคร</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((userItem) => (
                      <tr key={userItem.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(userItem.user_id)}
                            onChange={() => handleSelectUser(userItem.user_id)}
                            className="rounded border-gray-300"
                            disabled={userItem.isAdmin || userItem.user_id === user?.user_id}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{userItem.user_id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{userItem.user_email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {userItem.user_fname} {userItem.user_lname || ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {userItem.isAdmin ? (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">Admin</span>
                          ) : userItem.is_active === false ? (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">ระงับ</span>
                          ) : (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">User</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="space-y-1">
                            <div>📝 โพสต์: {userItem.stats?.posts || 0}</div>
                            <div>🍳 สูตร: {userItem.stats?.recipes || 0}</div>
                            <div>💬 คอมเมนต์: {userItem.stats?.comments || 0}</div>
                            <div>❤️ ไลค์: {userItem.stats?.totalLikes || 0}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          {userItem.mostSearched ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {userItem.mostSearched}
                            </span>
                          ) : (
                            '-'
                          )}
                          {userItem.searchCount > 0 && (
                            <div className="text-xs text-gray-500 mt-1">({userItem.searchCount} ครั้ง)</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(userItem.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-1">
                          <button
                            onClick={() => handleViewDetails(userItem.user_id)}
                            className="text-blue-600 hover:text-blue-900 font-medium text-xs"
                            title="ดูรายละเอียด"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => handleEditClick(userItem)}
                            className="text-blue-600 hover:text-blue-900 font-medium text-xs"
                            title="แก้ไข"
                          >
                            ✏️
                          </button>
                          {!userItem.isAdmin && userItem.user_id !== user?.user_id && (
                            <>
                              <button
                                onClick={() => handleToggleActive(userItem.user_id)}
                                className="text-yellow-600 hover:text-yellow-900 font-medium text-xs"
                                title={userItem.is_active === false ? 'เปิดใช้งาน' : 'ระงับ'}
                              >
                                {userItem.is_active === false ? '✅' : '⏸️'}
                              </button>
                              <button
                                onClick={() => handleDeleteClick(userItem.user_id, userItem.user_email)}
                                className="text-red-600 hover:text-red-900 font-medium text-xs"
                                title="ลบ"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary */}
          {!loading && (
            <div className="mt-4 text-sm text-gray-600">
              แสดงทั้งหมด {filteredUsers.length} จาก {users.length} รายการ
            </div>
          )}
        </div>
      </main>

      {/* Edit User Modal */}
      {isEditModalOpen && userToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">แก้ไขข้อมูลผู้ใช้</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                  <input
                    type="email"
                    name="user_email"
                    value={editFormData.user_email}
                    onChange={handleEditFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ</label>
                    <input
                      type="text"
                      name="user_fname"
                      value={editFormData.user_fname}
                      onChange={handleEditFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">นามสกุล</label>
                    <input
                      type="text"
                      name="user_lname"
                      value={editFormData.user_lname}
                      onChange={handleEditFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</label>
                  <input
                    type="tel"
                    name="user_tel"
                    value={editFormData.user_tel}
                    onChange={handleEditFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">แคลอรี่จำกัด (kcal)</label>
                  <input
                    type="number"
                    name="calorie_limit"
                    value={editFormData.calorie_limit}
                    onChange={handleEditFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">แพ้อาหาร (คั่นด้วยเครื่องหมายจุลภาค)</label>
                  <input
                    type="text"
                    name="allergies"
                    value={editFormData.allergies}
                    onChange={handleEditFormChange}
                    placeholder="เช่น ถั่ว, นม, กุ้ง"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">อาหารที่ชอบ (คั่นด้วยเครื่องหมายจุลภาค)</label>
                  <input
                    type="text"
                    name="favorite_foods"
                    value={editFormData.favorite_foods}
                    onChange={handleEditFormChange}
                    placeholder="เช่น ข้าวผัด, ต้มยำ, ผัดไทย"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={editFormData.is_active}
                    onChange={handleEditFormChange}
                    className="rounded border-gray-300"
                    disabled={userToEdit.isAdmin || userToEdit.user_id === user?.user_id}
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">เปิดใช้งานบัญชี</label>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setIsPasswordModalOpen(true);
                  }}
                  className="px-4 py-2 text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100"
                >
                  เปลี่ยนรหัสผ่าน
                </button>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                  disabled={updating}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmEdit}
                  disabled={updating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {isPasswordModalOpen && userToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">เปลี่ยนรหัสผ่าน</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ยืนยันรหัสผ่าน</label>
                  <input
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setPasswordData({ new_password: '', confirm_password: '' });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                  disabled={updating}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={updating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">รายละเอียดผู้ใช้</h2>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              {loadingDetails ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : userDetails ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-700">ข้อมูลส่วนตัว</h3>
                      <p>รหัส: {userDetails.user.user_id}</p>
                      <p>อีเมล: {userDetails.user.user_email}</p>
                      <p>ชื่อ: {userDetails.user.user_fname} {userDetails.user.user_lname || ''}</p>
                      <p>เบอร์โทร: {userDetails.user.user_tel || '-'}</p>
                      <p>สถานะ: {userDetails.user.isAdmin ? 'Admin' : (userDetails.user.is_active === false ? 'ระงับ' : 'ใช้งาน')}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700">สถิติ</h3>
                      <p>โพสต์: {userDetails.posts.length}</p>
                      <p>สูตรอาหาร: {userDetails.recipes.length}</p>
                      <p>คอมเมนต์: {userDetails.comments.length}</p>
                      <p>ไลค์โพสต์: {userDetails.postLikes.length}</p>
                      <p>ไลค์เมนู: {userDetails.menuLikes.length}</p>
                      <p>การค้นหา: {userDetails.searches.length}</p>
                    </div>
                  </div>
                  
                  {userDetails.posts.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">โพสต์ ({userDetails.posts.length})</h3>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {userDetails.posts.slice(0, 10).map(post => (
                          <div key={post.cpost_id} className="text-sm p-2 bg-gray-50 rounded">
                            {post.cpost_title} - {formatDate(post.cpost_datetime)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {userDetails.recipes.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">สูตรอาหาร ({userDetails.recipes.length})</h3>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {userDetails.recipes.slice(0, 10).map(recipe => (
                          <div key={recipe.recipe_id} className="text-sm p-2 bg-gray-50 rounded">
                            {recipe.recipe_title} - {formatDate(recipe.created_at)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {userDetails.searches.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">ประวัติการค้นหา ({userDetails.searches.length})</h3>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {userDetails.searches.slice(0, 20).map((search, idx) => (
                          <div key={idx} className="text-sm p-2 bg-gray-50 rounded">
                            "{search.search_query}" ({search.search_type}) - {formatDate(search.created_at)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      <ConfirmationModal
        isOpen={isBulkActionModalOpen}
        onClose={() => setIsBulkActionModalOpen(false)}
        onConfirm={handleBulkAction}
        title={`ยืนยันการ${bulkAction === 'delete' ? 'ลบ' : 'ระงับ'}ผู้ใช้`}
        message={`คุณแน่ใจหรือไม่ว่าต้องการ${bulkAction === 'delete' ? 'ลบ' : 'ระงับ'}ผู้ใช้ ${selectedUsers.length} รายการ?`}
        confirmText={bulkAction === 'delete' ? 'ลบ' : 'ระงับ'}
        cancelText="ยกเลิก"
        isDanger={true}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmDelete}
        title="ยืนยันการลบผู้ใช้"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ ${userToDelete?.email || ''}? การกระทำนี้ไม่สามารถยกเลิกได้`}
        confirmText="ลบ"
        cancelText="ยกเลิก"
        isDanger={true}
      />

      {/* Success Animation */}
      {showSuccess && <SuccessAnimation message="ดำเนินการสำเร็จ" />}
    </div>
  );
}

export default AdminUsersPage;
