import { Routes, Route, Navigate, useParams } from "react-router";
import { useEffect } from "react";
import { captureRef } from "./lib/referral";
import Home from "./pages/Home";
import Brand from "./pages/Brand";
import Business from "./pages/Business";
import Academy from "./pages/Academy";
import Join from "./pages/Join";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Verify from "./pages/Verify";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { MemberLayout } from "./pages/app/MemberLayout";
import AppHome from "./pages/app/AppHome";
import Properties from "./pages/app/Properties";
import Training from "./pages/app/Training";
import CourseView from "./pages/app/CourseView";
import LessonView from "./pages/app/LessonView";
import ExamView from "./pages/app/ExamView";
import Earnings from "./pages/app/Earnings";
import Team from "./pages/app/Team";
import Rewards from "./pages/app/Rewards";
import Links from "./pages/app/Links";
import Marketing from "./pages/app/Marketing";
import StarterKit from "./pages/app/StarterKit";
import AdminStarterKit from "./pages/admin/AdminStarterKit";
import AdminMarketing from "./pages/admin/AdminMarketing";
import Profile from "./pages/app/Profile";
import { AdminLayout } from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import AdminRealtors from "./pages/admin/AdminRealtors";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminBlog from "./pages/admin/AdminBlog";
import AdminCommissions from "./pages/admin/AdminCommissions";
import AdminPoints from "./pages/admin/AdminPoints";
import AdminAcademy from "./pages/admin/AdminAcademy";
import AdminCompliance from "./pages/admin/AdminCompliance";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminCms from "./pages/admin/AdminCms";
import AdminSettings from "./pages/admin/AdminSettings";

export default function App() {
  return (
    <Routes>      <Route path="/" element={<Home />} />
      <Route path="/brand" element={<Brand />} />
      <Route path="/business" element={<Business />} />
      <Route path="/academy" element={<Academy />} />
      <Route path="/join" element={<Join />} />
      {/* /r/:code — a member's personal referral link; redirects to /join with the code locked in */}
      <Route path="/r/:code" element={<ReferralRedirect />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/login" element={<Login />} />

      <Route path="/app" element={<MemberLayout />}>
        <Route index element={<AppHome />} />
        <Route path="properties" element={<Properties />} />
        <Route path="training" element={<Training />} />
        <Route path="training/:courseId" element={<CourseView />} />
        <Route path="training/:courseId/lesson/:lessonId" element={<LessonView />} />
        <Route path="training/:courseId/exam" element={<ExamView />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="team" element={<Team />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="links" element={<Links />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="starter-kit" element={<StarterKit />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        <Route path="realtors" element={<AdminRealtors />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="blog" element={<AdminBlog />} />
        <Route path="commissions" element={<AdminCommissions />} />
        <Route path="points" element={<AdminPoints />} />
        <Route path="academy" element={<AdminAcademy />} />
        <Route path="compliance" element={<AdminCompliance />} />
        <Route path="plans" element={<AdminPlans />} />
        <Route path="cms" element={<AdminCms />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="starter-kit" element={<AdminStarterKit />} />
        <Route path="marketing-tracker" element={<AdminMarketing />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/** /r/:code — locks the referral code into cookie + localStorage, then forwards to Join. */
function ReferralRedirect() {
  const { code } = useParams();
  useEffect(() => {
    if (code) captureRef(code);
  }, [code]);
  return <Navigate to={code ? `/join?ref=${encodeURIComponent(code)}` : "/join"} replace />;
}
