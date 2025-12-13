import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import flowerImage from "../../assets/images/option_logo2.png";
import { validateCredentials } from "../../services/userService";

export default function LoginPage() {
  const [userType, setUserType] = useState("ceo");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!userType || !name || !mobile || !password) {
      setError("Please fill all fields");
      return;
    }

    // Use userService for dynamic credential validation
    const result = validateCredentials(userType, name, mobile, password);

    if (result.success) {
      navigate("/dashboard", { state: { user: result.user } });
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* LEFT PANEL WITH WHITE BACKGROUND + CLEAN IMAGE DISPLAY */}
      <div
        className="hidden md:block md:w-1/2 bg-white bg-no-repeat bg-contain bg-center"
        style={{ backgroundImage: `url(${flowerImage})` }}
      />

      {/* RIGHT LOGIN FORM */}
      <div className="md:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h1 className="text-center text-3xl font-extrabold text-gray-900">
              Option Systems Login
            </h1>
            <p className="mt-2 text-center text-sm text-gray-600">
              Kitchen Product Management System
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* USER TYPE */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Select User Type
                </label>
                <select
                  value={userType}
                  onChange={(e) => setUserType(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                >
                  <option value="ceo">CEO</option>
                  <option value="employee">Employee</option>
                </select>
              </div>

              {/* NAME */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>

              {/* MOBILE */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="Enter mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>
            </div>

            {/* LOGIN BUTTON - GREEN */}
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Login
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
