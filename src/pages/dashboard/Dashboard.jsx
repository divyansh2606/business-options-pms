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
          itemWise: [], // Abhi ke liye empty
          menuItems: [], // Abhi ke liye empty
          financial: [], // Abhi ke liye empty
          dashboard: {
            eventType: pmsData[0] && pmsData[0][0],        // "Lunch"
            totalPlanned: pmsData[5] && pmsData[5][0],      // 100
            totalActual: pmsData[5] && pmsData[5][4],        // 50
            personCount: pmsData[0] && pmsData[0][7],      // 1000
            totalRecipes: recipeData.length
          }
        });
        
        console.log("Data stored in state successfully!");
      } catch (error) {
        console.error('Error fetching data:', error);
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
    // Refresh data logic here
    window.location.reload();
  };

  if (!user) {
    navigate("/login");
    return null;
  }

  // Get active tab label
  const getActiveTabLabel = () => {
    const allTabs = [
      { id: "dashboard", label: "Dashboard Summary" },
      { id: "stock", label: "Stock/Inventory" },
      { id: "orders", label: "Orders" },
      { id: "employees", label: "Employees" },
      { id: "menu", label: "Menu Items" },
      { id: "financial", label: "Financial Data" },
      ...(user.role === 'ceo' ? [{ id: "settings", label: "Settings" }] : [])
    ];
    
    const activeTabItem = allTabs.find(tab => tab.id === activeTab);
    return activeTabItem ? activeTabItem.label : "Dashboard";
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar Component */}
      <Sidebar 
        user={user}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 bg-gray-50 flex flex-col">
        {/* Top Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-8 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">
              {getActiveTabLabel()}
            </h2>
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleRefreshData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 5M14 12a1 1 0 00-1 1v-2.101a7.002 7.002 0 00-11.601-5M5 12a1 1 0 001 1v2.101a7.002 7.002 0 0011.601 5" clipRule="evenodd" />
                </svg>
                Refresh Data
              </button>
              <div className="text-sm text-gray-600">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Content Based on Active Tab */}
        <div className="flex-1 p-8 overflow-auto">
          {activeTab === "dashboard" && <DashboardSummary data={data} />}
          {activeTab === "stock" && <StockManagement data={data.itemWise} />}
          {activeTab === "orders" && <OrdersManagement data={data.pms} />}
          {activeTab === "employees" && <EmployeesManagement data={data.pms} />}
          {activeTab === "menu" && <MenuItemsManagement data={data.pms} />}
          {activeTab === "financial" && <FinancialData data={data.pms} />}
          {activeTab === "settings" && user.role === 'ceo' && <Settings />}
        </div>
      </div>
    </div>
  );
}