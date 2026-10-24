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

const COLORS = ['#274e3e', '#3a7a56', '#f2c14e', '#8aa891', '#c98a3a', '#5b8f6e', '#d4b483', '#b0543a'];

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
    <div className="rounded-2xl border border-[hsl(154_20%_82%)] bg-[hsl(var(--card))] p-4">
      <h3 className="mb-3 text-sm font-bold text-[hsl(155_33%_23%)]">{title}</h3>
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
            <Line type="monotone" dataKey="count" stroke="#274e3e" strokeWidth={2} dot={false} />
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
            <Bar dataKey="revenue" fill="#274e3e" radius={[4, 4, 0, 0]} />
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
            <Bar dataKey="count" fill="#3a7a56" radius={[0, 4, 4, 0]} />
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
