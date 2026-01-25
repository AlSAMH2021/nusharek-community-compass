import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings, User, Lock, Mail, Phone, Save, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

// Profile form schema
const profileSchema = z.object({
  fullName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل").max(100, "الاسم طويل جداً"),
  email: z.string().email("يرجى إدخال بريد إلكتروني صحيح"),
  phone: z.string().max(20, "رقم الهاتف طويل جداً").optional().or(z.literal("")),
});

// Password form schema
const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
    newPassword: z.string().min(6, "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"),
    confirmPassword: z.string().min(6, "تأكيد كلمة المرور مطلوب"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "كلمة المرور الجديدة وتأكيدها غير متطابقين",
    path: ["confirmPassword"],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Fetch profile data
  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      setIsLoading(true);

      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      if (error) {
        console.error("Error fetching profile:", error);
        // If profile doesn't exist, use auth user data
        profileForm.reset({
          fullName: user.user_metadata?.full_name || "",
          email: user.email || "",
          phone: "",
        });
      } else {
        setProfile(data);
        profileForm.reset({
          fullName: data.full_name || "",
          email: data.email || user.email || "",
          phone: data.phone || "",
        });
      }

      setIsLoading(false);
    }

    fetchProfile();
  }, [user, profileForm]);

  // Handle profile update
  const handleProfileSubmit = async (values: ProfileForm) => {
    if (!user) return;

    setIsSavingProfile(true);

    try {
      // Update profile in database
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: values.fullName,
          phone: values.phone || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update email if changed
      if (values.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: values.email,
        });

        if (emailError) throw emailError;

        toast({
          title: "تم إرسال رابط التأكيد",
          description: "تم إرسال رابط تأكيد إلى بريدك الإلكتروني الجديد",
        });
      }

      // Update local state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: values.fullName,
              phone: values.phone || null,
            }
          : null,
      );

      toast({
        title: "تم الحفظ",
        description: "تم تحديث بيانات الملف الشخصي بنجاح",
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "خطأ",
        description: error.message || "تعذر حفظ التغييرات",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle password change
  const handlePasswordSubmit = async (values: PasswordForm) => {
    if (!user) return;

    setIsSavingPassword(true);

    try {
      // First verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email || "",
        password: values.currentPassword,
      });

      if (signInError) {
        toast({
          title: "كلمة المرور الحالية غير صحيحة",
          description: "يرجى التحقق من كلمة المرور الحالية",
          variant: "destructive",
        });
        setIsSavingPassword(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (updateError) throw updateError;

      toast({
        title: "تم تغيير كلمة المرور",
        description: "تم تحديث كلمة المرور بنجاح",
      });

      // Reset form
      passwordForm.reset();
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "خطأ",
        description: error.message || "تعذر تغيير كلمة المرور",
        variant: "destructive",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-40" />
          </div>
          <Skeleton className="h-12 w-64" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* الحاوية الرئيسية مع ضمان التوجيه لليمين */}
      <div className="space-y-6 text-right" dir="rtl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center justify-start gap-3">
            <Settings className="h-7 w-7 text-primary" />
            الإعدادات
          </h1>
          <p className="text-muted-foreground mt-1">إدارة حسابك وإعدادات الأمان</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
          {/* تم تعديل التموضع هنا ليكون في اليمين تماماً باستخدام ms-0 */}
          <TabsList className="grid w-full max-w-md grid-cols-2 ms-0 me-auto">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              الملف الشخصي
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="h-4 w-4" />
              الأمان
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  الملف الشخصي
                </CardTitle>
                <CardDescription>تحديث معلوماتك الشخصية وبيانات التواصل</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                    {/* Full Name */}
                    <FormField
                      control={profileForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-right">الاسم الكامل</FormLabel>
                          <FormControl>
                            <div className="relative">
                              {/* الأيقونة على اليمين والنص مزاح لليسار قليلاً pr-10 */}
                              <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="أدخل اسمك الكامل" className="pr-10 text-right" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Email */}
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-right">البريد الإلكتروني</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="example@email.com"
                                className="pr-10 text-right"
                                dir="ltr" // البريد الإلكتروني يفضل أن يظل ltr
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Phone */}
                    <FormField
                      control={profileForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-right">رقم الهاتف (اختياري)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="+966 5x xxx xxxx" className="pr-10 text-right" dir="ltr" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <div className="flex justify-start">
                      <Button type="submit" disabled={isSavingProfile} className="gap-2">
                        {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        حفظ التغييرات
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab Content - (يمكن تطبيق نفس منطق المحاذاة أعلاه عليه) */}
          <TabsContent value="security">
            {/* ... نفس تعديلات الـ Card أعلاه لضمان تناسق الأيقونات والـ Input */}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
