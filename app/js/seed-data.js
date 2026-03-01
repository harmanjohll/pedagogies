/*
 * Co-Cher Seed Data
 * =================
 * Pre-populates 3 GCE O Level / G3 classes with 32 students each.
 * Students have Singapore-representative names (Chinese, Malay, Indian, Eurasian).
 */

import { Store, generateId } from './state.js';

const SEED_KEY = 'cocher_seeded';

/* ── Student name pools ── */
const NAMES = [
  // Class 1: Pure Chemistry
  'Tan Wei Lin', 'Muhammad Irfan', 'Priya Nair', 'Lim Jia Xuan',
  'Nur Aisyah', 'Raj Kumar', 'Chua Kai Wen', 'Siti Nurhaliza',
  'Arun Pillai', 'Ng Mei Ting', 'Ahmad Farhan', 'Kavitha Devi',
  'Ong Zhi Hao', 'Nurul Huda', 'Deepak Rajan', 'Chong Shu Min',
  'Iskandar Shah', 'Lakshmi Menon', 'Lee Jing Yi', 'Faizal Rahman',
  'Ananya Sharma', 'Wong Jia Hao', 'Hakim Abdullah', 'Revathi Suresh',
  'Koh Wen Xin', 'Zulkifli Omar', 'Meera Krishnan', 'Teo Yong Sheng',
  'Aina Batrisyia', 'Vikram Singh', 'Chan Hui Wen', 'Rashid Ismail',

  // Class 2: Combined Science
  'Lim Jun Wei', 'Nur Farhana', 'Arjun Reddy', 'Tan Xin Yi',
  'Muhammad Haziq', 'Divya Lakshmi', 'Goh Kai Ming', 'Siti Aminah',
  'Suresh Kumar', 'Ng Pei Shan', 'Amirul Hakim', 'Preethi Ravi',
  'Ong Jia Ying', 'Firdaus Malik', 'Rani Devi', 'Chua Wen Hao',
  'Nurul Izzah', 'Karthik Nair', 'Lee Hui Min', 'Zainab Bee',
  'Ravi Shankar', 'Wong Zi Xuan', 'Hafiz Azman', 'Amrita Kaur',
  'Koh Jia Wen', 'Shahirah Yusof', 'Dinesh Pillai', 'Teo Li Ting',
  'Aishah Zainal', 'Ganesh Babu', 'Chan Yee Heng', 'Nur Syafiqah',

  // Class 3: Mathematics
  'Lim Zhi Yong', 'Nur Athirah', 'Pranav Iyer', 'Tan Jia Qi',
  'Muhammad Aiman', 'Gayathri Devi', 'Goh Wen Jun', 'Siti Mariam',
  'Aravind Kumar', 'Ng Xin Hui', 'Amin Razak', 'Sangeetha Rao',
  'Ong Yi Xuan', 'Farid Hamzah', 'Pooja Nair', 'Chua Jun Jie',
  'Nurul Aini', 'Harish Menon', 'Lee Sze Ying', 'Zubaidah Hassan',
  'Srinivas Reddy', 'Wong Jia Wen', 'Imran Yusof', 'Nithya Balan',
  'Koh Zhi Xin', 'Syahirah Othman', 'Vijay Anand', 'Teo Xiu Ling',
  'Ain Nadhirah', 'Mohan Das', 'Chan Mei Xuan', 'Khairul Anwar'
];

function randomE21CC() {
  return {
    cait: 30 + Math.floor(Math.random() * 50),
    cci:  30 + Math.floor(Math.random() * 50),
    cgc:  30 + Math.floor(Math.random() * 50)
  };
}

export function seedIfNeeded() {
  if (localStorage.getItem(SEED_KEY)) return;
  if (Store.getClasses().length > 0) {
    localStorage.setItem(SEED_KEY, '1');
    return;
  }

  const classes = [
    { name: '4A Pure Chemistry', level: 'GCE O Level / G3', subject: 'Pure Chemistry' },
    { name: '4B Combined Science', level: 'GCE O Level / G3', subject: 'Combined Science' },
    { name: '4C Mathematics', level: 'GCE O Level / G3', subject: 'Mathematics' },
  ];

  classes.forEach((cls, ci) => {
    const created = Store.addClass(cls);
    const start = ci * 32;
    for (let i = 0; i < 32; i++) {
      Store.addStudent(created.id, {
        name: NAMES[start + i],
        e21cc: randomE21CC()
      });
    }
  });

  localStorage.setItem(SEED_KEY, '1');
}
