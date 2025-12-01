import React, { useContext, useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import NotificationDropdown from './NotificationDropdown';
import LogoutModal from './LogoutModal';

function Navbar() {
  const { token, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const profileMenuRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/');
    setShowLogoutModal(false);
  };

  const handleLogoutClick = () => {
    setShowProfileMenu(false);
    setShowLogoutModal(true);
  };

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  // ตรวจสอบว่าเป็น Admin หรือไม่
  const isAdmin = user?.isAdmin || false;

  // กำหนดสีตามสถานะ Admin
  const primaryColor = isAdmin ? 'red' : 'green';
  const primaryGradient = isAdmin 
    ? 'from-red-500 to-red-600' 
    : 'from-green-500 to-emerald-500';
  const primaryHover = isAdmin 
    ? 'hover:text-red-600' 
    : 'hover:text-green-600';
  const primaryBg = isAdmin 
    ? 'bg-red-50 text-red-700 hover:bg-red-100' 
    : 'bg-green-50 text-green-700 hover:bg-green-100';
  const primaryBorder = isAdmin 
    ? 'border-red-100' 
    : 'border-green-100';
  const primaryTextGradient = isAdmin
    ? 'from-red-600 to-red-700'
    : 'from-green-600 to-emerald-600';

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className={`fixed top-0 left-0 w-full bg-white/95 backdrop-blur-md shadow-lg z-50 border-b ${primaryBorder}`}>
      <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center max-w-7xl">
        <Link to="/" className="flex items-center space-x-2 group" onClick={closeMobileMenu}>
          <div className={`w-10 h-10 bg-gradient-to-br ${primaryGradient} rounded-full flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow`}>
            <span className="text-white font-bold text-xl">🍽️</span>
          </div>
          <div className={`font-bold text-xl sm:text-2xl bg-gradient-to-r ${primaryTextGradient} bg-clip-text text-transparent flex items-center gap-2 whitespace-nowrap`}>
            <span>MealVault</span>
            {isAdmin && (
              <span className="text-red-600 text-base font-semibold tracking-wide">[Admin]</span>
            )}
          </div>
        </Link>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-8">
          <Link to="/chatbot" className={`text-gray-700 ${primaryHover} transition-colors font-medium flex items-center space-x-1 group`}>
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>AI Chat Bot</span>
          </Link>
          <Link to="/" className={`text-gray-700 ${primaryHover} transition-colors font-medium`}>หน้าหลัก</Link>
          <Link to="/menus" className={`text-gray-700 ${primaryHover} transition-colors font-medium`}>เมนูอาหาร</Link>
          <Link to="/weekly-plan" className={`text-gray-700 ${primaryHover} transition-colors font-medium`}>วางแผนสัปดาห์</Link>
          <Link to="/community" className={`text-gray-700 ${primaryHover} transition-colors font-medium`}>ชุมชน</Link>
          <Link to="/about" className={`text-gray-700 ${primaryHover} transition-colors font-medium`}>About Us</Link>
          
          {token ? (
            <>
              <NotificationDropdown />
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className={`px-4 py-2 ${primaryBg} font-semibold rounded-full transition-colors duration-300`}
                >
                  {user ? `👤 ${user.user_fname}` : 'กำลังโหลด...'}
                </button>
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <Link
                      to="/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg transition-colors"
                    >
                      เข้าดูหน้าโปรไฟล์
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin/users"
                        onClick={() => setShowProfileMenu(false)}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        จัดการผู้ใช้(สำหรับadmin)
                      </Link>
                    )}
                    <button
                      onClick={handleLogoutClick}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg transition-colors"
                    >
                      ออกจากระบบ
                    </button>
                  </div>
                )}
              </div>
              <Link 
                to="/community/recipes/new"
                className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-full hover:bg-emerald-600 transition-all duration-300 hover:shadow-lg"
              >
                สร้างสูตรอาหาร
              </Link>
            </>
          ) : (
            <Link 
              to="/login" 
              className={`px-6 py-2 bg-gradient-to-r ${primaryGradient} text-white font-semibold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                isAdmin 
                  ? 'hover:from-red-600 hover:to-red-700' 
                  : 'hover:from-green-600 hover:to-emerald-600'
              }`}
            >
              เข้าสู่ระบบ
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="container mx-auto px-4 py-4 max-w-7xl space-y-3">
            <Link 
              to="/chatbot" 
              onClick={closeMobileMenu}
              className={`block py-2 text-gray-700 ${primaryHover} transition-colors font-medium flex items-center space-x-2`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>AI Chat Bot</span>
            </Link>
            <Link to="/" onClick={closeMobileMenu} className={`block py-2 text-gray-700 ${primaryHover} transition-colors font-medium`}>
              หน้าหลัก
            </Link>
            <Link to="/menus" onClick={closeMobileMenu} className={`block py-2 text-gray-700 ${primaryHover} transition-colors font-medium`}>
              เมนูอาหาร
            </Link>
            <Link to="/weekly-plan" onClick={closeMobileMenu} className={`block py-2 text-gray-700 ${primaryHover} transition-colors font-medium`}>
              วางแผนสัปดาห์
            </Link>
            <Link to="/community" onClick={closeMobileMenu} className={`block py-2 text-gray-700 ${primaryHover} transition-colors font-medium`}>
              ชุมชน
            </Link>
            <Link to="/about" onClick={closeMobileMenu} className={`block py-2 text-gray-700 ${primaryHover} transition-colors font-medium`}>
              About Us
            </Link>
            
            <div className="pt-3 border-t border-gray-200 space-y-3">
              {token ? (
                <>
                  <div className="flex items-center justify-between">
                    <Link to="/profile" onClick={closeMobileMenu} className={`px-4 py-2 ${primaryBg} font-semibold rounded-full transition-colors duration-300`}>
                      {user ? `👤 ${user.user_fname}` : 'กำลังโหลด...'}
                    </Link>
                    <NotificationDropdown />
                  </div>
                  {isAdmin && (
                    <Link 
                      to="/admin/users"
                      onClick={closeMobileMenu}
                      className="block w-full text-center px-4 py-2 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600 transition-all duration-300"
                    >
                      จัดการผู้ใช้
                    </Link>
                  )}
                  <Link 
                    to="/community/recipes/new"
                    onClick={closeMobileMenu}
                    className="block w-full text-center px-4 py-2 bg-emerald-500 text-white font-semibold rounded-full hover:bg-emerald-600 transition-all duration-300"
                  >
                    สร้างสูตรอาหาร
                  </Link>
                </>
              ) : (
                <Link 
                  to="/login"
                  onClick={closeMobileMenu}
                  className={`block w-full text-center px-6 py-2 bg-gradient-to-r ${primaryGradient} text-white font-semibold rounded-full transition-all duration-300 shadow-lg ${
                    isAdmin 
                      ? 'hover:from-red-600 hover:to-red-700' 
                      : 'hover:from-green-600 hover:to-emerald-600'
                  }`}
                >
                  เข้าสู่ระบบ
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </nav>
  );
}

export default Navbar;

