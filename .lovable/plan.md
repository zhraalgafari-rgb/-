
## أولاً: مميزات مقترحة لإدارة الديون والعملاء (بصفة خبير)

تحسينات يحتاجها التطبيق فعلاً لرفع جودة متابعة الديون:

1. **تذكيرات ذكية للسداد**: إشعار تلقائي قبل/عند تاريخ الاستحقاق لكل دين، مع زر "إرسال تذكير عبر واتساب/SMS" يفتح رسالة جاهزة بالاسم والمبلغ.
2. **تواريخ استحقاق وأقساط**: إضافة `due_date` لكل معاملة + دعم تقسيم الدين على أقساط (جدول سداد مع متابعة المتأخر).
3. **حالة العميل**: تصنيف تلقائي (منتظم / متأخر / متعثر) حسب سلوك السداد + درجة ثقة (Credit Score داخلي).
4. **كشف حساب PDF لكل عميل**: زر "أرسل كشف حساب" يولّد PDF احترافي بالشعار والمعاملات والرصيد.
5. **تسوية جزئية ذكية**: زر "تسوية" يقفل المعاملات القديمة تلقائياً (FIFO) عند استلام دفعة.
6. **مرفقات للمعاملة**: صورة إيصال/سند قبض مرفق مع كل معاملة (Storage موجود).
7. **بحث عام Global Search**: بحث في الأشخاص + المعاملات + المصاريف من شريط واحد.
8. **مشاركة الدين**: رابط مشاركة آمن للعميل لعرض رصيده فقط (read-only token).
9. **تنبيهات الحدود**: تنبيه عند تجاوز عميل لحد ائتماني محدد له.
10. **Undo فوري** بعد كل حذف/تعديل (toast مع Undo خلال 5 ثواني).

> سأنفّذ في هذه المرحلة: (1) تذكيرات تاريخ الاستحقاق، (2) كشف حساب PDF للعميل، (4) Undo، (5) البحث العام. الباقي يحتاج جلسة لاحقة.

---

## ثانياً: تقسيم الملفات الضخمة

الملفات الكبيرة المعقدة حالياً:
- `src/routes/app.person.$id.tsx` — صفحة العميل (تجمع رأس + معاملات + إجراءات + حوارات).
- `src/routes/app.settings.data.tsx` — استيراد/تصدير/نسخ احتياطي.
- `src/routes/app.expenses.tsx` — رأس + قائمة + فلاتر + شهر.
- `src/components/AddTransactionDialog.tsx` و `ExpenseDialog.tsx`.
- `src/lib/backup.ts`.

خطة التقسيم:
- `app.person.$id.tsx` → `features/person/PersonHeader.tsx`, `PersonActions.tsx`, `PersonTransactionsList.tsx`, `hooks/usePersonData.ts`.
- `app.settings.data.tsx` → `features/settings/data/ExportPanel.tsx`, `ImportPanel.tsx`, `BackupPanel.tsx`, `RestorePanel.tsx`.
- `app.expenses.tsx` → `features/expenses/ExpensesFilters.tsx`, `ExpensesList.tsx`, `hooks/useExpensesData.ts`.
- `backup.ts` → `lib/backup/snapshot.ts`, `upload.ts`, `restore.ts`, `auto.ts`.
- `AddTransactionDialog.tsx` و `ExpenseDialog.tsx` → استخراج `useTransactionForm` / `useExpenseForm` hooks + `PersonPicker`, `CurrencyPicker`, `CategoryPicker` sub-components.

---

## ثالثاً: تسريع التنقل بين الصفحات

الأسباب الحالية والإصلاحات:

1. **لا يوجد TanStack Query** — كل صفحة تعيد جلب البيانات من Supabase عند كل دخول. الحل: إدخال `@tanstack/react-query` مع `QueryClientProvider` في `__root.tsx`، وتحويل كل `useEffect+supabase.from(...)` إلى `useQuery` مع `staleTime: 30s` و `queryKey` ثابت لكل مورد (people, transactions, currencies, categories, expenses).
2. **Preload الروابط**: تفعيل `defaultPreload: "intent"` في `src/router.tsx` ليبدأ التحميل عند hover/touch.
3. **Skeleton ثابت + Optimistic UI**: إظهار البيانات المخزّنة فوراً ثم التحديث في الخلفية (SWR-style).
4. **Code-splitting للحوارات الثقيلة**: `AddTransactionDialog`, `ExpenseDialog`, `OnboardingFlow` عبر `lazy()` لتقليل حجم الباندل الابتدائي.
5. **مذكِرة الحسابات الثقيلة**: `personBalances` و `categoryTotals` تُحسب من جديد كل render — تأكيد `useMemo` بمفاتيح صحيحة + نقل التجميع لمستوى الـ store/query.
6. **Invalidation مركزي**: بعد أي insert/update/delete نستدعي `queryClient.invalidateQueries({ queryKey: [...] })` بدلاً من إعادة `load()` يدوياً في كل صفحة.

التأثير المتوقع: التنقل بين تبويب الديون والمصاريف يصبح فورياً (من ~400ms إلى <50ms في الزيارة الثانية).

---

## رابعاً: استيراد وتصدير المعاملات (PDF و Excel)

### تصدير Export
- **Excel (.xlsx)**: عبر `xlsx` (SheetJS) — ورقتان: "الأشخاص+الأرصدة" و "المعاملات". زر في `app.settings.data.tsx` و في صفحة العميل (تصدير معاملات شخص واحد).
- **PDF**: عبر `jspdf` + `jspdf-autotable` مع دعم العربية (تضمين خط Tajawal كـ base64). نموذجان: كشف حساب عميل، تقرير شهري شامل.

### استيراد Import
- **Excel (.xlsx, .csv)**: قراءة بـ `xlsx`، عرض معاينة Mapping (المستخدم يطابق الأعمدة: الاسم/المبلغ/الاتجاه/التاريخ/العملة/الملاحظة) ثم استيراد دفعة مع تقرير نجاح/فشل لكل صف.
- **PDF**: استخراج النص بـ `pdfjs-dist` ثم تحليل تلقائي للجداول (heuristic للأرقام + التواريخ). يعرض جدول مقترح للمراجعة قبل الحفظ. (دقة محدودة لـ PDF الممسوحة ضوئياً — رسالة واضحة للمستخدم).

ملفات جديدة:
- `src/lib/io/exportExcel.ts`, `exportPdf.ts`, `importExcel.ts`, `importPdf.ts`.
- `src/components/import/ImportWizard.tsx` (3 خطوات: اختر ملف → طابق الأعمدة → راجع واحفظ).
- إضافة قسم "استيراد/تصدير" في `app.settings.data.tsx`.

التبعيات الجديدة:
- `@tanstack/react-query`, `xlsx`, `jspdf`, `jspdf-autotable`, `pdfjs-dist`.

---

## ترتيب التنفيذ المقترح
1. TanStack Query + preload + lazy dialogs (أكبر أثر على السرعة).
2. تقسيم `app.person.$id.tsx` و `backup.ts` و `app.settings.data.tsx`.
3. ميزات الديون: due_date + كشف PDF + Undo + بحث عام.
4. ImportWizard + Export Excel/PDF.

هذا حجم كبير (3-4 جلسات بناء). هل أبدأ بالخطوات 1 و 4 الآن (السرعة + الاستيراد/التصدير) لأنها أعلى قيمة فورية، أم أنفّذ كل شيء بالترتيب؟
