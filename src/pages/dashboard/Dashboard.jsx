import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Import components
import Sidebar from "../../components/Sidebar";
import DashboardSummary from "./DashboardSummary";
import StockManagement from "./StockManagement";
import OrdersManagement from "./OrdersManagement";
import EmployeesManagement from "./EmployeesManagement";
import MenuItemsManagement from "./MenuItemsManagement";
import FinancialData from "./FinancialData";
import Settings from "./Settings";

// Import API functions
import { fetchPMSData, fetchRecipeData } from "../../api/restaurantAPI";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = location.state?.user;
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    pms: [],        
    recipe: [],      
    itemWise: [],    
    menuItems: [],    
    financial: [],
    dashboard: {}    
  });

  // Google Sheets se data fetch karne ke liye
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        console.log("Fetching data from Google Sheets...");
        
        // PMS sheet se data laao
        const pmsData = await fetchPMSData();
        console.log("PMS Data:", pmsData);
        
        // Recipe sheet se data laao
        const recipeData = await fetchRecipeData();
        console.log("Recipe Data:", recipeData);
        
        // Data state mein store karo
        setData({
          pms: pmsData,
          recipe: recipeData,
          itemWise: [],
          menuItems: [],
          financial: [],
          dashboard: {
            eventType: pmsData[0] && pmsData[0][0],
            totalPlanned: pmsData[5] && pmsData[5][0],
            totalActual: pmsData[5] && pmsData[5][4],
            personCount: pmsData[0] && pmsData[0][7],
            totalRecipes: recipeData.length
          }
        });
        
        console.log("Data stored in state successfully!");
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const handleLogout = () => {
    navigate("/login");
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  const handleRefreshData = () => {
    window.location.reload();
  };

  if (!user) {
    navigate("/login");
    return null;
  }

  // Get active tab label
  const getActiveTabLabel = () => {
    const allTabs = [
      { id: "dashboard", label: "Production Summary" },
      { id: "stock", label: "Stock/Inventory" },
      { id: "orders", label: "Orders" },
      { id: "employees", label: "Employees" },
      { id: "menu", label: "Menu Items" },
      { id: "financial", label: "Financial Data" },
      ...(user.role === 'ceo' ? [{ id: "settings", label: "Settings" }] : [])
    ];
    
    const activeTabItem = allTabs.find(tab => tab.id === activeTab);
    return activeTabItem ? activeTabItem.label : "Production Summary";
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Component - Fixed Position */}
      <Sidebar 
        user={user}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onLogout={handleLogout}
      />

      {/* Main Content Area - ml-64 for fixed sidebar offset */}
      <main className="ml-64 flex-1 flex flex-col min-w-0">
        {/* Top Header Bar - Sticky at top */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-8 py-5 sticky top-0 z-40 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">
                {getActiveTabLabel()}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Welcome back, {user.name}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleRefreshData}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5 mr-2" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" 
                    clipRule="evenodd" 
                  />
                </svg>
                Refresh Data
              </button>
              <div className="px-4 py-2 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-500 font-medium">Last updated</p>
                <p className="text-sm text-gray-700 font-semibold">
                  {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Based on Active Tab - Scrollable */}
        <div className="flex-1 p-8 overflow-x-auto overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Loading data...</p>
              </div>
            </div>
          ) : (
            <div className="min-w-max">
              {activeTab === "dashboard" && <DashboardSummary data={data} />}
              {activeTab === "stock" && <StockManagement data={data.itemWise} />}
              {activeTab === "orders" && <OrdersManagement data={data.pms} />}
              {activeTab === "employees" && <EmployeesManagement data={data.pms} />}
              {activeTab === "menu" && <MenuItemsManagement data={data.pms} />}
              {activeTab === "financial" && <FinancialData data={data.pms} />}
              {activeTab === "settings" && user.role === 'ceo' && <Settings />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}