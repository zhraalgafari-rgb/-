
# خطة تطوير "دفترك" إلى نظام محاسبي احترافي متعدد العملات

نطاق ضخم جداً (16 محور). سأنفذه على **6 مراحل متتابعة** لضمان الجودة وعدم كسر شيء. كل مرحلة قابلة للاختبار قبل الانتقال للتالية.

---

## المرحلة 1 — البنية التحتية للعملات المتعددة (الأهم)

**الهدف**: فصل كامل بين العملات (SAR أساسية، YER ثانوية) — لا اختلاط بين الأرصدة.

- **قاعدة البيانات**:
  - تعيين SAR كعملة أساسية افتراضياً (تحديث `seed_default_currencies`).
  - جدول جديد `exchange_rates` (currency_id, rate_to_base, effective_date, created_by, note) + RLS + GRANT + فهارس.
  - إضافة أعمدة `original_amount`, `original_currency_id`, `rate_at_tx`, `base_equivalent` على `transactions` و `expenses`.
  - جدول `opening_balances` (user_id, person_id, currency_id, amount, opening_date, note) + سجل تعديلات في `audit_log`.
- **منطق التطبيق**:
  - `src/lib/money/` (وحدة جديدة): `convert.ts`, `rates.ts`, `balances.ts` — حساب الأرصدة لكل عملة على حدة.
  - تعديل `PersonBalanceCard` لعرض **بطاقة منفصلة لكل عملة** (لا تجميع).
  - تحديث ledger الرئيسي لعرض إجماليات لكل عملة في صفوف مستقلة.

## المرحلة 2 — أسعار الصرف والأرصدة الافتتاحية

- صفحة `app.exchange-rates.tsx`: عرض/تحديث يومي + سجل تاريخي كامل + من قام بالتعديل.
- استخدام `rate_at_tx` تلقائياً عند إدخال أي معاملة (snapshot للسعر).
- صفحة `app.opening-balances.tsx`: إدخال/تعديل أرصدة افتتاحية لكل عميل×عملة، مع مقارنة مع الرصيد الحالي.
- التقارير التاريخية تستخدم `rate_at_tx` لا السعر الحالي.

## المرحلة 3 — الاستيراد الذكي بـ AI (Excel/PDF) لـ 1700+ عميل

- server function `parseImportFile` تستخدم Gemini لاكتشاف الأعمدة تلقائياً (اسم، هاتف، رصيد، عملة، آخر دفعة...).
- توسيع `ImportWizard` بمعاينة + إزالة تكرار (fuzzy على الاسم+الهاتف) + تحقق + ربط الأعمدة الذكي.
- استيراد دفعي batched (100 صف/دفعة) لأداء جيد مع +1700 عميل.
- استخراج PDF عبر `pdfjs-dist` + AI لاستخراج الجداول.

## المرحلة 4 — كشف حساب احترافي + واتساب + المرفقات

- إعادة تصميم `exportPersonStatementPDF`: شعار، معلومات الشركة، جداول ملونة، فصل العملات، رصيد افتتاحي، رصيد جاري، إجماليات لكل عملة + ما يعادلها بالأساسية.
- إعداد جديد `app.settings.company.tsx` (شعار، عنوان، هاتف، إيميل).
- Excel احترافي مماثل عبر `xlsx-js-style` للألوان والحدود.
- مشاركة واتساب: توليد ملف Excel جاهز + نص ملخص + رابط.
- **المرفقات**: توسيع bucket `receipts` ليدعم PDF/Excel/صور لكل معاملة + مكون `AttachmentManager` (preview/download/delete).

## المرحلة 5 — AI متقدم + تصنيف العملاء + ملف العميل الشامل

- `rateCustomer` server fn: تحليل سلوك الدفع → Excellent/Very Good/Good/Average/High Risk + شرح.
- `dailyExecutiveSummary` و `predictLatePayments` و `detectAnomalies`.
- تحويل `app.person.$id.tsx` إلى مركز شامل:
  - `PersonProfile`, `PersonBalancesByCurrency`, `PersonAnalyticsCharts` (recharts)، `PersonHealthScore`, `PersonAiRecommendations`, `PersonTimeline`, `SimilarCustomers`.

## المرحلة 6 — البحث العالمي + الوضع الداكن + إعادة الهيكلة

- `GlobalSearchBar` في الهيدر (يفتح modal بنتائج فورية fuzzy عبر `fuse.js` على cache محلي): عملاء/فواتير/معاملات/مبالغ/أرقام.
- زر **Dark Mode** بجوار الإشعارات في الهيدر (يستخدم `theme.tsx` الموجود).
- تقسيم الملفات الكبيرة المتبقية: `ImportWizard`, `ExpenseDialog`, `app.settings.data` → مكونات صغيرة.
- توثيق `src/lib/money/README.md` + إزالة الكود الميت + فهارس DB.

---

## التفاصيل التقنية

**جداول جديدة**: `exchange_rates`, `opening_balances`, `company_profile`, `attachments` (إذا لزم منفصل).
**أعمدة جديدة**: `transactions.original_currency_id/rate_at_tx/base_equivalent`, مثلها للـ `expenses`.
**حزم جديدة**: `fuse.js` (بحث)، `pdfjs-dist` (استخراج PDF)، `xlsx-js-style` (Excel ملوّن)، `recharts` (موجود؟ تحقق).
**أمان**: RLS لكل جدول جديد + GRANT صريح + `service_role`.
**أداء**: فهارس على `(user_id, person_id, currency_id, transaction_date)` و `(user_id, effective_date desc)` لـ exchange_rates.
**بدون كسر**: تحويل البيانات الموجودة (migration) — كل معاملة موجودة يتم ملء `original_currency_id = currency_id` و `rate_at_tx = currencies.rate` الحالي.

---

## الموافقة المطلوبة

هل أبدأ بـ **المرحلة 1** الآن (البنية التحتية للعملات + migration للبيانات الموجودة)؟ أم تفضل ترتيباً مختلفاً للأولويات؟

أنصح بالترتيب أعلاه لأن كل مرحلة تبني على سابقتها (لا يمكن عمل تقارير تاريخية دون snapshot للأسعار، ولا تصنيف AI دون أرصدة منفصلة لكل عملة).
