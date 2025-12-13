// User Service - localStorage-based user management
const STORAGE_KEY = 'pms_users';

// Default CEO user
const DEFAULT_CEO = {
    id: 'ceo_001',
    name: 'ceo',
    mobile: '',
    password: 'password123',
    role: 'ceo',
    status: 'active',
    createdAt: new Date().toISOString()
};

// Initialize storage with default CEO if empty
const initializeStorage = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_CEO]));
        return [DEFAULT_CEO];
    }
    return JSON.parse(stored);
};

// Get all users
export const getUsers = () => {
    return initializeStorage();
};

// Get all employees (exclude CEO)
export const getEmployees = () => {
    const users = getUsers();
    return users.filter(user => user.role === 'employee');
};

// Add new user (employee)
export const addUser = (userData) => {
    const users = getUsers();

    // Check if user with same name and mobile exists
    const exists = users.find(
        u => u.name.toLowerCase() === userData.name.toLowerCase() && u.mobile === userData.mobile
    );

    if (exists) {
        return { success: false, message: 'User with same name and mobile already exists' };
    }

    const newUser = {
        id: `emp_${Date.now()}`,
        name: userData.name,
        mobile: userData.mobile,
        password: userData.password,
        role: 'employee',
        status: 'active',
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));

    return { success: true, message: 'User created successfully', user: newUser };
};

// Update user
export const updateUser = (userId, userData) => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
        return { success: false, message: 'User not found' };
    }

    // Prevent editing CEO role
    if (users[index].role === 'ceo' && userData.role !== 'ceo') {
        return { success: false, message: 'Cannot change CEO role' };
    }

    users[index] = {
        ...users[index],
        name: userData.name || users[index].name,
        mobile: userData.mobile || users[index].mobile,
        password: userData.password || users[index].password,
        status: userData.status || users[index].status,
        updatedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));

    return { success: true, message: 'User updated successfully', user: users[index] };
};

// Delete user
export const deleteUser = (userId) => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);

    if (!user) {
        return { success: false, message: 'User not found' };
    }

    // Prevent deleting CEO
    if (user.role === 'ceo') {
        return { success: false, message: 'Cannot delete CEO account' };
    }

    const filteredUsers = users.filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredUsers));

    return { success: true, message: 'User deleted successfully' };
};

// Validate login credentials
export const validateCredentials = (userType, name, mobile, password) => {
    const users = getUsers();

    if (userType === 'ceo') {
        const ceo = users.find(u => u.role === 'ceo');
        if (ceo && ceo.name === name && ceo.password === password) {
            return {
                success: true,
                user: { name: 'CEO', role: 'ceo', mobile }
            };
        }
        return { success: false, message: 'Invalid CEO credentials' };
    }

    // Employee login
    const employee = users.find(
        u => u.role === 'employee' &&
            u.name === name &&
            u.mobile === mobile &&
            u.password === password &&
            u.status === 'active'
    );

    if (employee) {
        return {
            success: true,
            user: { name: employee.name, role: 'employee', mobile: employee.mobile }
        };
    }

    return { success: false, message: 'Invalid employee credentials' };
};

// Toggle user status (active/inactive)
export const toggleUserStatus = (userId) => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
        return { success: false, message: 'User not found' };
    }

    users[index].status = users[index].status === 'active' ? 'inactive' : 'active';
    users[index].updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));

    return { success: true, message: 'User status updated', user: users[index] };
};
