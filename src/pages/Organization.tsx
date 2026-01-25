import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Building2, 
  Globe, 
  Phone, 
  Mail, 
  MapPin, 
  Save, 
  Pencil, 
  X,
  CheckCircle2,
  Calendar,
  Briefcase
} from "lucide-react";

const organizationSchema = z.object({
  name: z.string().min(2, "اسم المنظمة يجب أن يكون حرفين على الأقل").max(100, "اسم المنظمة طويل جداً"),
  nameEn: z.string().max(100, "الاسم طويل جداً").optional(),
  type: z.enum(["government", "non_profit", "private_sector", "other"]),
  sector: z.string().max(100, "القطاع طويل جداً").optional(),
  description: z.string().max(500, "الوصف طويل جداً").optional(),
  website: z.string().url("يرجى إدخال رابط صحيح").max(255, "الرابط طويل جداً").optional().or(z.literal("")),
  contactEmail: z.string().email("يرجى إدخال بريد إلكتروني صحيح").max(255, "البريد طويل جداً").optional().or(z.literal("")),
  contactPhone: z.string().max(20, "رقم الهاتف طويل جداً").optional(),
  city: z.string().max(100, "اسم المدينة طويل جداً").optional(),
});

type OrganizationForm = z.infer<typeof organizationSchema>;

interface Organization {
  id: string;
  name: string;
  name_en: string | null;
  type: "government" | "non_profit" | "private_sector" | "other";
  sector: string | null;
  description: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

const organizationTypes = [
  { value: "government", label: "جهة حكومية" },
  { value: "non_profit", label: "منظمة غير ربحية" },
  { value: "private_sector", label: "قطاع خاص" },
  { value: "other", label: "أخرى" },
];

const getTypeLabel = (type: string) => {
  return organizationTypes.find((t) => t.value === type)?.label || type;
};

export default function OrganizationPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
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

  // Fetch organization data
  useEffect(() => {
    async function fetchOrganization() {
      if (!user) return;

      setIsLoading(true);

      // Get user's organization membership
      const { data: membership, error: memberError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberError) {
        console.error("Error fetching membership:", memberError);
        setIsLoading(false);
        return;
      }

      if (!membership) {
        // User has no organization, redirect to setup
        navigate("/organization/setup");
        return;
      }

      // Fetch organization details
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", membership.organization_id)
        .single();

      if (orgError) {
        console.error("Error fetching organization:", orgError);
        toast({
          title: "خطأ",
          description: "تعذر تحميل بيانات المنظمة",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setOrganization(org);

      // Populate form with existing data
      form.reset({
        name: org.name || "",
        nameEn: org.name_en || "",
        type: org.type,
        sector: org.sector || "",
        description: org.description || "",
        website: org.website || "",
        contactEmail: org.contact_email || "",
        contactPhone: org.contact_phone || "",
        city: org.city || "",
      });

      setIsLoading(false);
    }

    fetchOrganization();
  }, [user, navigate, toast, form]);

  const handleSubmit = async (values: OrganizationForm) => {
    if (!organization) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: values.name,
          name_en: values.nameEn || null,
          type: values.type,
          sector: values.sector || null,
          description: values.description || null,
          website: values.website || null,
          contact_email: values.contactEmail || null,
          contact_phone: values.contactPhone || null,
          city: values.city || null,
        })
        .eq("id", organization.id);

      if (error) throw error;

      // Update local state
      setOrganization((prev) =>
        prev
          ? {
              ...prev,
              name: values.name,
              name_en: values.nameEn || null,
              type: values.type,
              sector: values.sector || null,
              description: values.description || null,
              website: values.website || null,
              contact_email: values.contactEmail || null,
              contact_phone: values.contactPhone || null,
              city: values.city || null,
            }
          : null
      );

      toast({
        title: "تم الحفظ",
        description: "تم تحديث بيانات المنظمة بنجاح",
      });

      setIsEditing(false);
    } catch (error: any) {
      console.error("Error updating organization:", error);
      toast({
        title: "خطأ",
        description: error.message || "تعذر حفظ التغييرات",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    if (organization) {
      form.reset({
        name: organization.name || "",
        nameEn: organization.name_en || "",
        type: organization.type,
        sector: organization.sector || "",
        description: organization.description || "",
        website: organization.website || "",
        contactEmail: organization.contact_email || "",
        contactPhone: organization.contact_phone || "",
        city: organization.city || "",
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!organization) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">لم يتم العثور على منظمة</h2>
          <p className="text-muted-foreground mb-4">يبدو أنك لم تنضم إلى منظمة بعد</p>
          <Button onClick={() => navigate("/organization/setup")}>
            إنشاء منظمة جديدة
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Building2 className="h-7 w-7 text-primary" />
              بيانات المنظمة
            </h1>
            <p className="text-muted-foreground mt-1">
              عرض وتعديل معلومات منظمتك
            </p>
          </div>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Pencil className="ml-2 h-4 w-4" />
              تعديل البيانات
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
                <X className="ml-2 h-4 w-4" />
                إلغاء
              </Button>
              <Button onClick={form.handleSubmit(handleSubmit)} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="ml-2 h-4 w-4" />
                )}
                حفظ التغييرات
              </Button>
            </div>
          )}
        </div>

        {/* View Mode */}
        {!isEditing ? (
          <div className="grid gap-6">
            {/* Main Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  المعلومات الأساسية
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground">اسم المنظمة (بالعربية)</label>
                      <p className="text-lg font-medium">{organization.name}</p>
                    </div>
                    {organization.name_en && (
                      <div>
                        <label className="text-sm text-muted-foreground">اسم المنظمة (بالإنجليزية)</label>
                        <p className="text-lg font-medium text-left" dir="ltr">{organization.name_en}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <label className="text-sm text-muted-foreground">نوع المنظمة</label>
                        <p className="font-medium">{getTypeLabel(organization.type)}</p>
                      </div>
                    </div>
                    {organization.sector && (
                      <div>
                        <label className="text-sm text-muted-foreground">القطاع / المجال</label>
                        <p className="font-medium">{organization.sector}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {organization.city && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <label className="text-sm text-muted-foreground">المدينة</label>
                          <p className="font-medium">{organization.city}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <label className="text-sm text-muted-foreground">تاريخ التسجيل</label>
                        <p className="font-medium">
                          {new Date(organization.created_at).toLocaleDateString("ar-SA", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {organization.description && (
                  <div className="mt-6 pt-6 border-t">
                    <label className="text-sm text-muted-foreground">نبذة عن المنظمة</label>
                    <p className="mt-1 text-muted-foreground leading-relaxed">{organization.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  معلومات التواصل
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {organization.contact_email && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">البريد الإلكتروني</label>
                        <a
                          href={`mailto:${organization.contact_email}`}
                          className="block font-medium text-primary hover:underline"
                          dir="ltr"
                        >
                          {organization.contact_email}
                        </a>
                      </div>
                    </div>
                  )}

                  {organization.contact_phone && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">رقم الهاتف</label>
                        <a
                          href={`tel:${organization.contact_phone}`}
                          className="block font-medium text-primary hover:underline"
                          dir="ltr"
                        >
                          {organization.contact_phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {organization.website && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Globe className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">الموقع الإلكتروني</label>
                        <a
                          href={organization.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block font-medium text-primary hover:underline"
                          dir="ltr"
                        >
                          {organization.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    </div>
                  )}

                  {!organization.contact_email && !organization.contact_phone && !organization.website && (
                    <p className="text-muted-foreground col-span-3">
                      لم يتم إضافة معلومات تواصل بعد
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Edit Mode */
          <Card>
            <CardHeader>
              <CardTitle>تعديل بيانات المنظمة</CardTitle>
              <CardDescription>
                قم بتحديث المعلومات ثم اضغط على "حفظ التغييرات"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-6">
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
                              className="text-left"
                              dir="ltr"
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
                          <Select onValueChange={field.onChange} value={field.value}>
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
                                className="pr-10 text-left"
                                dir="ltr"
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
                                className="pr-10 text-left"
                                dir="ltr"
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
                                className="pr-10 text-left"
                                dir="ltr"
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
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
