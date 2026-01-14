import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NusharekLogo } from "@/components/NusharekLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Globe, Phone, Mail, MapPin } from "lucide-react";

const organizationSchema = z.object({
  name: z.string().min(2, "اسم المنظمة يجب أن يكون حرفين على الأقل"),
  nameEn: z.string().optional(),
  type: z.enum(["government", "non_profit", "private_sector", "other"]),
  sector: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url("يرجى إدخال رابط صحيح").optional().or(z.literal("")),
  contactEmail: z.string().email("يرجى إدخال بريد إلكتروني صحيح").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  city: z.string().optional(),
});

type OrganizationForm = z.infer<typeof organizationSchema>;

const organizationTypes = [
  { value: "government", label: "جهة حكومية" },
  { value: "non_profit", label: "منظمة غير ربحية" },
  { value: "private_sector", label: "قطاع خاص" },
  { value: "other", label: "أخرى" },
];

export default function OrganizationSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<OrganizationForm>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: "",
      nameEn: "",
      type: "government",
      sector: "",
      description: "",
      website: "",
      contactEmail: "",
      contactPhone: "",
      city: "",
    },
  });

  const handleSubmit = async (values: OrganizationForm) => {
    if (!user) {
      toast({
        title: "خطأ",
        description: "يجب تسجيل الدخول أولاً",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsLoading(true);

    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: values.name,
          name_en: values.nameEn || null,
          type: values.type,
          sector: values.sector || null,
          description: values.description || null,
          website: values.website || null,
          contact_email: values.contactEmail || null,
          contact_phone: values.contactPhone || null,
          city: values.city || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as organization member (admin)
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: org.id,
          user_id: user.id,
          is_admin: true,
        });

      if (memberError) throw memberError;

      toast({
        title: "تم إنشاء المنظمة بنجاح",
        description: "يمكنك الآن بدء التقييم الذاتي",
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error creating organization:", error);
      toast({
        title: "خطأ في إنشاء المنظمة",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen nusharek-pattern py-12 px-4">
      <div className="container max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <NusharekLogo size="lg" />
        </div>

        <Card className="border-2 border-border/50 shadow-xl animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-3">
              <Building2 className="h-7 w-7 text-primary" />
              تسجيل معلومات المنظمة
            </CardTitle>
            <CardDescription className="text-base">
              أدخل بيانات منظمتك للبدء في رحلة التقييم الذاتي
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Organization Name */}
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم المنظمة (بالعربية) *</FormLabel>
                        <FormControl>
                          <Input placeholder="اسم المنظمة" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nameEn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم المنظمة (بالإنجليزية)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Organization Name" 
                            className="direction-ltr text-left"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Type and Sector */}
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>نوع المنظمة *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر نوع المنظمة" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {organizationTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>القطاع / المجال</FormLabel>
                        <FormControl>
                          <Input placeholder="مثال: التعليم، الصحة، البيئة" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نبذة عن المنظمة</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="وصف مختصر عن أهداف ونشاطات المنظمة"
                          className="resize-none"
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Contact Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>البريد الإلكتروني للتواصل</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="info@organization.com" 
                              className="pr-10 direction-ltr text-left"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>رقم الهاتف</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="+966 5x xxx xxxx" 
                              className="pr-10 direction-ltr text-left"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Website and City */}
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الموقع الإلكتروني</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Globe className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="https://www.organization.com" 
                              className="pr-10 direction-ltr text-left"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المدينة</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="الرياض" className="pr-10" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جارٍ إنشاء المنظمة...
                    </>
                  ) : (
                    "إنشاء المنظمة والمتابعة"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}