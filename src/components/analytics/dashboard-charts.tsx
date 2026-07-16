"use client";

import { Pie, PieChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Label, LabelList } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";

export function StatusDonutChart({ data }: { data: { name: string; count: number; color: string | null }[] }) {
  const chartData = data.map((d) => ({
    status: d.name,
    count: d.count,
    fill: d.color ?? "var(--color-primary)",
  }));

  const config = data.reduce((acc, d) => {
    acc[d.name] = { label: d.name, color: d.color ?? "hsl(var(--primary))" };
    return acc;
  }, {} as ChartConfig);

  config.count = { label: "Assets" };

  const totalAssets = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Utilization by Status</CardTitle>
        <CardDescription>Current asset lifecycle state</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[250px]">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                          {totalAssets.toLocaleString()}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-xs">
                          Assets
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent />} className="-translate-y-2 flex-wrap gap-2" />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function CategoryHorizontalBarChart({ data }: { data: { name: string; count: number }[] }) {
  const chartData = data.map((d, i) => ({
    category: d.name,
    count: d.count,
    fill: `hsl(var(--chart-${(i % 5) + 1}))`,
  }));

  const config = {
    count: { label: "Assets" },
  } as ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assets by Category</CardTitle>
        <CardDescription>Top categories by volume</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: -20, right: 10 }}>
            <CartesianGrid horizontal={false} vertical={true} strokeDasharray="3 3" opacity={0.3} />
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <XAxis dataKey="count" type="number" hide />
            <ChartTooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }} content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={4}>
              <LabelList dataKey="count" position="right" offset={8} className="fill-foreground" fontSize={12} />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function ValueBarChart({ data }: { data: { name: string; total: number }[] }) {
  const chartData = data.map((d, i) => ({
    category: d.name,
    value: d.total,
    fill: `hsl(var(--chart-${(i % 5) + 1}))`,
  }));

  const config = {
    value: { label: "Value (EGP)" },
  } as ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Value by Category</CardTitle>
        <CardDescription>Total purchase cost (EGP)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <BarChart data={chartData} margin={{ top: 20 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              fontSize={12}
              tickFormatter={(value) => value.slice(0, 10)}
            />
            <YAxis hide />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
              content={<ChartTooltipContent formatter={(v) => Number(v).toLocaleString("en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 })} />}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="value"
                position="top"
                offset={8}
                className="fill-foreground"
                fontSize={12}
                formatter={(v: unknown) => {
                  const num = Number(v);
                  return num > 1000 ? `${(num / 1000).toFixed(1)}k` : String(v);
                }}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
