import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NusharekLogo } from "@/components/NusharekLogo";
import {
  Target,
  Goal,
  Layers,
  Users,
  Building,
  Pencil,
  Play,
  MessageSquare,
  ClipboardCheck,
  Eye,
  FileText,
  ArrowLeft,
  CheckCircle,
  Building2,
  TrendingUp,
  Lightbulb,
} from "lucide-react";

// المحاور الـ 11 للتقييم حسب قاعدة البيانات
const dimensions = [
  {
    icon: Target,
    title: "تحديد المشكلة / القضية",
    description: "تحديد القضية أو الموضوع محل إشراك المجتمع بوضوح",
  },
  {
    icon: Goal,
    title: "تحديد الغرض والعناصر القابلة وغير القابلة للتفاوض",
    description: "تحديد أهداف المشاركة والعناصر القابلة للتفاوض",
  },
  {
    icon: Layers,
    title: "تحديد مستوى المشاركة المجتمعية",
    description: "اختيار مستوى المشاركة المناسب",
  },
  {
    icon: Users,
    title: "تحديد أصحاب المصلحة وبناء العلاقات",
    description: "تحديد وبناء علاقات مع أصحاب المصلحة",
  },
  {
    icon: Building,
    title: "الموارد والحوكمة",
    description: "تخصيص الموارد وآليات الحوكمة",
  },
  {
    icon: Pencil,
    title: "تصميم عملية المشاركة",
    description: "تصميم عملية المشاركة بشكل مناسب",
  },
  {
    icon: Play,
    title: "تنفيذ المشاركة المجتمعية",
    description: "تنفيذ أنشطة المشاركة وفق الخطة",
  },
  {
    icon: MessageSquare,
    title: "التغذية الراجعة",
    description: "توثيق وإبلاغ المشاركين بنتائج مشاركتهم",
  },
  {
    icon: ClipboardCheck,
    title: "التقييم والمراجعة",
    description: "تقييم عملية المشاركة وقياس تحقيق الأهداف",
  },
  {
    icon: Eye,
    title: "المراقبة والمتابعة",
    description: "متابعة نتائج المشاركة على المدى الطويل",
  },
  {
    icon: FileText,
    title: "التوثيق والتدقيق",
    description: "توثيق جميع مراحل المشاركة المجتمعية",
  },
];

const features = [
  {
    icon: FileText,
    title: "تقييم ذاتي شامل",
    description: "استبيان مفصّل يغطي جميع جوانب المشاركة المجتمعية عبر 11 محوراً",
  },
  {
    icon: TrendingUp,
    title: "تحليلات مرئية",
    description: "رسوم بيانية ومخططات رادار لفهم أفضل للنتائج",
  },
  {
    icon: CheckCircle,
    title: "توصيات مخصصة",
    description: "اقتراحات عملية للتحسين بناءً على نتائج التقييم",
  },
];

// مستويات النضج الثلاثة حسب التقييم
const maturityLevels = [
  {
    level: "أساسي",
    range: "0-49%",
    color: "bg-level-beginner",
    description: "المستوى الأول في رحلة المشاركة المجتمعية، يتطلب بناء الأسس والقدرات",
  },
  {
    level: "ناشئ",
    range: "50-74%",
    color: "bg-level-developing",
    description: "مرحلة النمو والتطور في ممارسات المشاركة المجتمعية",
  },
  {
    level: "مثالي",
    range: "75-100%",
    color: "bg-level-leading",
    description: "نموذج متميز ورائد في تطبيق أفضل ممارسات المشاركة المجتمعية",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <NusharekLogo size="sm" />
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">ابدأ الآن</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="gradient-hero text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 nusharek-pattern opacity-20" />
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              منصة التقييم الذاتي للمشاركة المجتمعية
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              قيّم مستوى نضج منظمتك في المشاركة المجتمعية واحصل على توصيات عملية للتطوير والتحسين
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" variant="secondary" className="text-lg px-8" asChild>
                <Link to="/auth">
                  سجّل منظمتك الآن
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 bg-white/10 border-white/30 hover:bg-white/20"
              >
                <a href="#dimensions">تعرّف على المحاور</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">لماذا نُشارك؟</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              نُشارك منصة متكاملة لتقييم وتطوير ممارسات المشاركة المجتمعية في المنظمات
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Dimensions Section */}
      <section id="dimensions" className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">محاور التقييم الأحد عشر</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              نموذج شامل يغطي جميع مراحل دورة المشاركة المجتمعية الفعّالة
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {dimensions.map((dimension, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all hover:-translate-y-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                      <dimension.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base leading-tight">{dimension.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm">{dimension.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Maturity Levels Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">مستويات النضج</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              اكتشف موقع منظمتك على سلم النضج في المشاركة المجتمعية
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {maturityLevels.map((level, index) => (
              <Card key={index} className="relative overflow-hidden">
                <div className={`absolute top-0 right-0 left-0 h-2 ${level.color}`} />
                <CardHeader className="pt-6">
                  <CardTitle className="text-2xl">{level.level}</CardTitle>
                  <p className="text-lg font-medium text-muted-foreground">{level.range}</p>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{level.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">من يمكنه الاستفادة؟</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Building2, title: "الجهات الحكومية" },
              { icon: Users, title: "منظمات المجتمع المدني" },
              { icon: Target, title: "القطاع الخاص" },
              { icon: Lightbulb, title: "المبادرات المجتمعية" },
            ].map((audience, index) => (
              <div
                key={index}
                className="flex flex-col items-center text-center p-6 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <audience.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{audience.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 gradient-primary text-white">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">ابدأ رحلة التطوير اليوم</h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            سجّل منظمتك الآن وابدأ التقييم الذاتي لتحسين ممارسات المشاركة المجتمعية
          </p>
          <Button size="lg" variant="secondary" className="text-lg px-8" asChild>
            <Link to="/auth">
              سجّل منظمتك مجاناً
              <ArrowLeft className="mr-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-secondary text-secondary-foreground">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <NusharekLogo size="sm" />
            <p className="text-sm text-secondary-foreground/70">
              © {new Date().getFullYear()} نُشارك - جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
