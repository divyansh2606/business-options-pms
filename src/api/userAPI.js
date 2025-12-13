// src/api/userAPI.js
// User Authentication API - Google Sheets backend integration

const USER_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzY3uLGK4pY4ci1R_rdla-tE9cADkbsQkrYKb82_Uof9rU5ym59k4qc09Orv6kw4i5s/exec";

/**
 * Fetch wrapper with timeout and retry
 */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000, retries = 1) {
  const controller = new AbortController();
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...opts, signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err && err.name === 'AbortError';
    
    if (retries > 0 && !isAbort) {
      await new Promise(res => setTimeout(res, 300));
      return fetchWithTimeout(url, opts, timeoutMs, retries - 1);
    }
    
    const wrapped = new Error(isAbort ? 'Request timed out' : (err && err.message) || 'Network error');
    wrapped.original = err;
    throw wrapped;
  }
}

/**
 * Safe JSON parse
 */
async function parseResponse(response) {
  const contentType = (response && response.headers && response.headers.get('content-type')) || '';
  let text = await response.text();
  
  if (!text) return null;
  text = String(text).trim();
  
  // Remove trailing characters that might interfere with JSON parsing
  text = text.replace(/[^\x20-\x7E]+$/g, '');
  
  // Try to parse as JSON
  if (contentType.includes('application/json') || text.startsWith('[') || text.startsWith('{')) {
    try {
      return JSON.parse(text);
    } catch (jsonErr) {
      // Try to find JSON in the text
      const jsonMatch = text.match(/(\[.*\]|\{.*\})/s);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (innerErr) {
          console.error('Failed to parse JSON from matched text:', innerErr);
        }
      }
      throw new Error('Invalid JSON response: ' + text.substring(0, 100));
    }
  }
  
  return text;
}

/**
 * Get all users from Google Sheets
 */
export async function getUsers() {
  try {
    const url = `${USER_APPS_SCRIPT_URL}?action=getUsers&_=${Date.now()}`;
    const response = await fetchWithTimeout(url, {}, 10000, 2);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await parseResponse(response);
    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

/**
 * Validate user credentials
 */
export async function validateCredentials(userType, name, mobile, password) {
  try {
    const params = new URLSearchParams({
      action: 'validateCredentials',
      userType: userType,
      name: name,
      mobile: mobile,
      password: password,
      _: Date.now()
    });
    
    const url = `${USER_APPS_SCRIPT_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, {}, 10000, 2);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await parseResponse(response);
    return data;
  } catch (error) {
    console.error('Error validating credentials:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.'
    };
  }
}

/**
 * Add new user (employee)
 */
export async function addUser(userData) {
  try {
    const params = new URLSearchParams({
      action: 'addUser',
      name: userData.name,
      mobile: userData.mobile,
      password: userData.password,
      role: userData.role || 'employee',
      status: userData.status || 'active',
      _: Date.now()
    });
    
    const url = `${USER_APPS_SCRIPT_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, {}, 10000, 2);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await parseResponse(response);
    return data;
  } catch (error) {
    console.error('Error adding user:', error);
    return {
      success: false,
      message: 'Network error. Could not add user.'
    };
  }
}

/**
 * Update existing user
 */
export async function updateUser(userId, userData) {
  try {
    const params = new URLSearchParams({
      action: 'updateUser',
      userId: userId,
      _: Date.now()
    });
    
    if (userData.name) params.append('name', userData.name);
    if (userData.mobile) params.append('mobile', userData.mobile);
    if (userData.password) params.append('password', userData.password);
    if (userData.status) params.append('status', userData.status);
    
    const url = `${USER_APPS_SCRIPT_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, {}, 10000, 2);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await parseResponse(response);
    return data;
  } catch (error) {
    console.error('Error updating user:', error);
    return {
      success: false,
      message: 'Network error. Could not update user.'
    };
  }
}

/**
 * Delete user
 */
export async function deleteUser(userId) {
  try {
    const params = new URLSearchParams({
      action: 'deleteUser',
      userId: userId,
      _: Date.now()
    });
    
    const url = `${USER_APPS_SCRIPT_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, {}, 10000, 2);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await parseResponse(response);
    return data;
  } catch (error) {
    console.error('Error deleting user:', error);
    return {
      success: false,
      message: 'Network error. Could not delete user.'
    };
  }
}

/**
 * Toggle user status (active/inactive)
 */
export async function toggleUserStatus(userId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  return updateUser(userId, { status: newStatus });
}
