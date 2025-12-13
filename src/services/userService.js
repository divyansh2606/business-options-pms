// User Service - Google Sheets backend authentication
import * as userAPI from '../api/userAPI';

// Cache for users to reduce API calls
let usersCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 30000; // 30 seconds

// Initialize and get users from backend
const getUsers = async () => {
    // Check cache first
    const now = Date.now();
    if (usersCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
        return usersCache;
    }
    
    try {
        const users = await userAPI.getUsers();
        usersCache = users;
        cacheTimestamp = now;
        return users;
    } catch (error) {
        console.error('Error fetching users:', error);
        
        // Fallback to default CEO if API fails
        return [{
            id: 'ceo_001',
            name: 'ceo',
            mobile: '',
            password: 'password123',
            role: 'ceo',
            status: 'active',
            createdAt: new Date().toISOString()
        }];
    }
};

// Clear cache
const clearCache = () => {
    usersCache = null;
    cacheTimestamp = null;
};

// Get all employees (exclude CEO)
export const getEmployees = async () => {
    const users = await getUsers();
    return users.filter(user => user.role === 'employee');
};

// Add new user (employee)
export const addUser = async (userData) => {
    try {
        const result = await userAPI.addUser(userData);
        if (result.success) {
            clearCache(); // Clear cache to force refresh
        }
        return result;
    } catch (error) {
        return { 
            success: false, 
            message: 'Network error. Could not add user.' 
        };
    }
};

// Update user
export const updateUser = async (userId, userData) => {
    try {
        const result = await userAPI.updateUser(userId, userData);
        if (result.success) {
            clearCache();
        }
        return result;
    } catch (error) {
        return { 
            success: false, 
            message: 'Network error. Could not update user.' 
        };
    }
};

// Delete user
export const deleteUser = async (userId) => {
    try {
        const result = await userAPI.deleteUser(userId);
        if (result.success) {
            clearCache();
        }
        return result;
    } catch (error) {
        return { 
            success: false, 
            message: 'Network error. Could not delete user.' 
        };
    }
};

// Validate login credentials (now using backend API)
export const validateCredentials = async (userType, name, mobile, password) => {
    try {
        const result = await userAPI.validateCredentials(userType, name, mobile, password);
        return result;
    } catch (error) {
        console.error('Validation error:', error);
        return { 
            success: false, 
            message: 'Network error. Please check your connection and try again.' 
        };
    }
};

// Toggle user status (active/inactive)
export const toggleUserStatus = async (userId) => {
    try {
        const users = await getUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return { success: false, message: 'User not found' };
        }
        
        const result = await userAPI.toggleUserStatus(userId, user.status);
        if (result.success) {
            clearCache();
        }
        return result;
    } catch (error) {
        return { 
            success: false, 
            message: 'Network error. Could not update user status.' 
        };
    }
};
