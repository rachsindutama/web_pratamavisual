import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ui/ProtectedRoute';

// Public Pages
import Categories from './pages/Categories';
import CategoryDetail from './pages/CategoryDetail';
import AlbumDetail from './pages/AlbumDetail';
import Pricing from './pages/Pricing';
import Booking from './pages/Booking';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthLayout from './components/layout/AuthLayout';

// Client Pages
import MyBookings from './pages/client/MyBookings';
import MyTestimonials from './pages/client/MyTestimonials';
import ClientSettings from './pages/client/ClientSettings';
import MyPhotos from './pages/client/MyPhotos';
import MyFiles from './pages/client/MyFiles';

// Admin Pages
import AdminLayout from './components/admin/AdminLayout';
import ClientLayout from './components/layout/ClientLayout';
import Dashboard from './pages/admin/Dashboard';
import SiteSettings from './pages/admin/SiteSettings';
import ManageCategories from './pages/admin/ManageCategories';
import ManageAlbums from './pages/admin/ManageAlbums';
import ManageVideos from './pages/admin/ManageVideos';
import ManagePricing from './pages/admin/ManagePricing';
import ManageBookings from './pages/admin/ManageBookings';
import Cashflow from './pages/admin/Cashflow';
import ManageTestimonials from './pages/admin/ManageTestimonials';
import ManageFileServer from './pages/admin/ManageFileServer';
import ManageTaxes from './pages/admin/ManageTaxes';
import HardReset from './pages/admin/HardReset';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Categories /> },
      { path: 'categories/:categorySlug', element: <CategoryDetail /> },
      { path: 'categories/:categorySlug/:albumSlug', element: <AlbumDetail /> },
      { path: 'pricing', element: <Pricing /> },
      { path: 'booking', element: <Booking /> },
      {
        element: <AuthLayout />,
        children: [
          { path: 'login',    element: <Login /> },
          { path: 'register', element: <Register /> },
        ],
      },
    ],
  },
  {
    path: '/my-bookings',
    element: (
      <ProtectedRoute>
        <ClientLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <MyBookings /> },
      { path: 'testimonials', element: <MyTestimonials /> },
      { path: 'photos', element: <MyPhotos /> },
      { path: 'files', element: <MyFiles /> },
      { path: 'settings', element: <ClientSettings /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'settings', element: <SiteSettings /> },
      { path: 'bookings', element: <ManageBookings /> },
      { path: 'cashflow', element: <Cashflow /> },
      { path: 'categories', element: <ManageCategories /> },
      { path: 'album', element: <ManageAlbums /> },
      { path: 'videos', element: <ManageVideos /> },
      { path: 'pricing', element: <ManagePricing /> },
      { path: 'testimonials', element: <ManageTestimonials /> },
      { path: 'file-server', element: <ManageFileServer /> },
      { path: 'taxes', element: <ManageTaxes /> },
      { path: 'hard-reset', element: <HardReset /> },
    ],
  },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
