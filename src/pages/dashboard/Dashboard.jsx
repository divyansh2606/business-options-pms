import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Import components
import Sidebar from "../../components/Sidebar";
import DashboardSummary from "./DashboardSummary";
import ProductionSummary from "./ProductionSummary"; // ✅ New Import
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
      { id: "dashboard", label: "Production Plan" },
      { id: "productionSummary", label: "Production Summary" }, // ✅ New Tab Label
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
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 ml-0 min-w-0 transition-all duration-300">
        {/* Top Navigation Bar */}
        <div className="bg-white shadow-sm sticky top-0 z-20 px-4 md:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            {/* Hamburger Menu (Mobile Only) */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="mr-4 text-gray-600 hover:text-indigo-600 md:hidden focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-800">{getActiveTabLabel()}</h1>
              <p className="hidden md:block text-sm text-gray-500">Welcome back, {user.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <button
              onClick={handleRefreshData}
              className="px-3 md:px-5 py-2 md:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center shadow-md hover:shadow-lg transform hover:scale-105 text-sm md:text-base"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden md:inline">Refresh Data</span>
              <span className="md:hidden">Refresh</span>
            </button>
            <div className="h-8 w-8 md:h-10 md:w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-base md:text-lg border-2 border-indigo-200">
              {user.name.charAt(0)}
            </div>
          </div>
        </div>

        {/* Dynamic Content Rendering */}
        <div className="p-4 md:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[50vh]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Loading data...</p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-full">
              {activeTab === "dashboard" && <DashboardSummary data={data.pms} />}
              {activeTab === "productionSummary" && <ProductionSummary />}
              {activeTab === "stock" && <StockManagement data={data.itemWise} user={user} />}
              {activeTab === "orders" && <OrdersManagement data={data.pms} />}
              {activeTab === "employees" && <EmployeesManagement data={data.pms} />}
              {activeTab === "menu" && <MenuItemsManagement data={data.pms} />}
              {activeTab === "financial" && <FinancialData data={data.pms} />}
              {activeTab === "settings" && user.role === 'ceo' && <Settings />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}