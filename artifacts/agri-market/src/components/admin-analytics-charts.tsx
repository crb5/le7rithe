import { type ReactNode } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useAdminAnalytics } from '@/hooks/use-admin';

const COLORS = ['#1B5E4F', '#9C3F55', '#4A8577', '#B4496A', '#2D4A42', '#6B4552', '#7FA89C', '#C97D93'];

const STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  pending_review: 'بانتظار المراجعة',
  pending_payment: 'بانتظار الدفع',
  rejected: 'مرفوض',
  draft: 'مسودة',
  expired: 'منتهٍ',
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[hsl(167_16%_78%)] bg-[hsl(var(--card))] p-4">
      <h3 className="mb-3 text-sm font-bold text-[hsl(167_55%_24%)]">{title}</h3>
      <div className="h-56 w-full" dir="ltr">{children}</div>
    </div>
  );
}

export function AdminAnalyticsCharts() {
  const { data } = useAdminAnalytics();
  if (!data) return null;

  const statusData = data.statusBreakdown.map((s) => ({
    name: STATUS_LABELS[s.status] ?? s.status,
    value: s.count,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="الإعلانات خلال 30 يومًا">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.listingsPerDay} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e2d8" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#1B5E4F" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="الإيرادات اليومية (MRU)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.paymentsPerDay} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e2d8" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="revenue" fill="#1B5E4F" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="أكثر الفئات (إعلانات نشطة)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data.topCategories} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e2d8" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#4A8577" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="حالة الإعلانات">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${e.value}`} labelLine={false}>
              {statusData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
