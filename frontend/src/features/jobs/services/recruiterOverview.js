// API calendar dates describe the selected browser time zone. Construct local
// calendar dates rather than parsing YYYY-MM-DD as UTC and shifting the labels.
export function parseApplicationOverview(data) {
  return { ...data, days: data.days.map(({ date, count }) => {
    const [year, month, day] = date.split('-').map(Number);
    return { date: new Date(year, month - 1, day), count };
  }) };
}
