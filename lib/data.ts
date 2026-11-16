export type Customer = {
  id: string
  name: string
  phone: string
  area: string
  purifier: string
  serial: string
  amc: string
  lastTds: number
  nextService: string
  avatar: string
}

export type Job = {
  id: string
  customer: string
  address: string
  type: string
  time: string
  technician: string
  status: string
  phone: string
  inputTds: number
  outputTds: number
}

export type Tenant = {
  id: string
  name: string
  owner: string
  city: string
  customDomain: string
  slug: string
  gstin: string
  upi: string
  active: boolean
  logo?: string
}

export const tenants: Tenant[] = [
  { id: 'sr-water', name: 'SR WATER SOLUTIONS', owner: 'Arif', city: 'Hyderabad', customDomain: 'srwatersolutions.in', slug: 'sr-water-solutions', gstin: '36ABKFS4821L1Z8', upi: 'srwater@okaxis', active: true },
  { id: 'aqua-care', name: 'AQUA CARE SERVICES', owner: 'Rohan', city: 'Pune', customDomain: 'aquacare.in', slug: 'aqua-care', gstin: '27AACCA2210A1Z5', upi: 'aquacare@okicici', active: true },
  { id: 'blue-drop', name: 'BLUE DROP SYSTEMS', owner: 'Meera', city: 'Bengaluru', customDomain: 'bluedrop.co.in', slug: 'blue-drop-systems', gstin: '29AABCB1432J1Z2', upi: 'bluedrop@oksbi', active: true },
]

const areas = ['Madhapur', 'Kondapur', 'Gachibowli', 'Kukatpally', 'Miyapur', 'Banjara Hills', 'Manikonda', 'Hitech City', 'Jubilee Hills', 'Secunderabad', 'Begumpet', 'Ameerpet', 'Nallagandla', 'Kompally', 'Uppal', 'LB Nagar', 'Tolichowki']
const names = ['Ananya Reddy', 'Vikram Rao', 'Fatima Khan', 'Kiran Kumar', 'Priya Sharma', 'Sanjay Gupta', 'Lakshmi Nair', 'Rahul Verma', 'Sana Ahmed', 'Arjun Mehta', 'Nisha Patel', 'Adil Hussain', 'Divya Iyer', 'Suresh Babu', 'Neha Joshi', 'Imran Ali', 'Pooja Menon']

export const customers: Customer[] = names.map((name, index) => ({
  id: `CUS-${String(1042 + index).padStart(4, '0')}`,
  name,
  phone: `+91 98${String(42103600 + index * 173).slice(0, 8)}`,
  area: areas[index],
  purifier: ['Kent Grand Plus', 'Aquaguard Aura', 'Pureit Copper+', 'AO Smith Z9', 'Livpure Pep Pro'][index % 5],
  serial: `SRW-${2024 + index % 2}-${String(10438 + index * 137).padStart(5, '0')}`,
  amc: index < 12 ? 'Active' : index === 12 ? 'Expiring soon' : 'Not covered',
  lastTds: [34, 42, 28, 51, 36][index % 5],
  nextService: index === 4 ? 'In 5 days' : `${12 + index} days`,
  avatar: name.split(' ').map((part) => part[0]).slice(0, 2).join(''),
}))

export const technicians = [
  { name: 'Ramesh Kumar', area: 'Madhapur · 500081', done: 4, pending: 1, cash: 4200, color: 'blue' },
  { name: 'Sajid Ali', area: 'Kondapur · 500084', done: 3, pending: 2, cash: 2850, color: 'purple' },
  { name: 'Naveen Reddy', area: 'Gachibowli · 500032', done: 2, pending: 1, cash: 3600, color: 'green' },
  { name: 'Mahesh Babu', area: 'Kukatpally · 500072', done: 3, pending: 0, cash: 1950, color: 'amber' },
  { name: 'Imran Khan', area: 'Banjara Hills · 500034', done: 2, pending: 1, cash: 5100, color: 'pink' },
]

export const jobs: Job[] = [
  { id: 'JOB-2841', customer: 'Ananya Reddy', address: 'Madhapur, Hyderabad', type: 'Routine Filter Change', time: '09:30 AM', technician: 'Ramesh Kumar', status: 'Completed', phone: customers[0].phone, inputTds: 486, outputTds: 34 },
  { id: 'JOB-2842', customer: 'Vikram Rao', address: 'Kondapur, Hyderabad', type: 'AMC Visit', time: '10:30 AM', technician: 'Sajid Ali', status: 'In Progress', phone: customers[1].phone, inputTds: 520, outputTds: 42 },
  { id: 'JOB-2843', customer: 'Fatima Khan', address: 'Gachibowli, Hyderabad', type: 'Breakdown Repair', time: '11:30 AM', technician: 'Naveen Reddy', status: 'Technician En Route', phone: customers[2].phone, inputTds: 610, outputTds: 28 },
  { id: 'JOB-2844', customer: 'Kiran Kumar', address: 'Kukatpally, Hyderabad', type: 'Routine Filter Change', time: '02:00 PM', technician: 'Mahesh Babu', status: 'Scheduled', phone: customers[3].phone, inputTds: 455, outputTds: 51 },
  { id: 'JOB-2845', customer: 'Priya Sharma', address: 'Miyapur, Hyderabad', type: 'AMC Visit', time: '04:00 PM', technician: 'Imran Khan', status: 'Scheduled', phone: customers[4].phone, inputTds: 390, outputTds: 36 },
]

export const inventory = [
  { name: 'Sediment Filter 10"', sku: 'FLT-SED-10', stock: 24, minimum: 10, cost: 180, unit: 'pcs' },
  { name: 'Pre-carbon Candle', sku: 'FLT-CARB-10', stock: 8, minimum: 10, cost: 240, unit: 'pcs' },
  { name: 'RO Membrane 75 GPD', sku: 'MEM-75-GPD', stock: 16, minimum: 6, cost: 1150, unit: 'pcs' },
  { name: 'UV Lamp 11W', sku: 'UV-11W', stock: 5, minimum: 8, cost: 620, unit: 'pcs' },
  { name: 'Booster Pump 100 GPD', sku: 'PMP-100', stock: 7, minimum: 4, cost: 1450, unit: 'pcs' },
  { name: 'John Guest Elbow 1/4"', sku: 'FIT-ELB-14', stock: 42, minimum: 20, cost: 35, unit: 'pcs' },
]

export const invoices = [
  { id: 'INV-2025-0841', customer: 'Ananya Reddy', date: '16 Nov 2025', amount: 2499, status: 'Paid', type: 'Filter replacement' },
  { id: 'INV-2025-0840', customer: 'Vikram Rao', date: '16 Nov 2025', amount: 8500, status: 'Paid', type: 'AMC renewal' },
  { id: 'INV-2025-0839', customer: 'Fatima Khan', date: '15 Nov 2025', amount: 1850, status: 'Paid', type: 'Breakdown repair' },
  { id: 'INV-2025-0838', customer: 'Kiran Kumar', date: '15 Nov 2025', amount: 3200, status: 'Pending', type: 'Routine service' },
  { id: 'INV-2025-0837', customer: 'Priya Sharma', date: '14 Nov 2025', amount: 1199, status: 'Paid', type: 'UV lamp replacement' },
  { id: 'INV-2025-0836', customer: 'Sanjay Gupta', date: '12 Nov 2025', amount: 5999, status: 'Paid', type: 'AMC renewal' },
  { id: 'INV-2025-0835', customer: 'Lakshmi Nair', date: '10 Nov 2025', amount: 3200, status: 'Overdue', type: 'Filter replacement' },
  { id: 'INV-2025-0834', customer: 'Rahul Verma', date: '09 Nov 2025', amount: 4500, status: 'Paid', type: 'Breakdown repair' },
]

export const products = [
  { name: 'AquaPure RO+UV Elite', type: 'Residential · 7 stage', mrp: 18999, dealer: 12499, stock: 12, image: '01' },
  { name: 'CrystalFlow Copper Max', type: 'Residential · Copper + RO', mrp: 24999, dealer: 16800, stock: 7, image: '02' },
  { name: 'HydroPro Commercial 50 LPH', type: 'Commercial · 50 LPH', mrp: 68999, dealer: 48200, stock: 3, image: '03' },
]

export const revenueByMonth = [
  { month: 'Jun', amount: 54800 }, { month: 'Jul', amount: 62300 }, { month: 'Aug', amount: 59700 },
  { month: 'Sep', amount: 71400 }, { month: 'Oct', amount: 76650 }, { month: 'Nov', amount: 84503 },
]

export const money = (value: number) => `₹${value.toLocaleString('en-IN')}`
