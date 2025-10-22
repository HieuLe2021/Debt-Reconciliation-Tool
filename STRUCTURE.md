# Cấu Trúc Dự Án - Debt Reconciliation Tool

## 📁 Tổng Quan Cấu Trúc

```
Debt-Reconciliation-Tool/
├── components/          # Các React components
│   ├── AppHeader.tsx           # Header với supplier selector và theme toggle
│   ├── DataTable.tsx           # Bảng hiển thị dữ liệu
│   ├── ErrorAlert.tsx          # Component hiển thị thông báo lỗi
│   ├── ErrorModal.tsx          # Modal hiển thị chi tiết lỗi từ AI
│   ├── FeedbackModal.tsx       # Modal gửi phản hồi
│   ├── ReconciliationResultDisplay.tsx  # Hiển thị kết quả đối chiếu
│   ├── SkuMappingModal.tsx     # Modal tạo SKU mapping
│   ├── Spinner.tsx             # Loading spinner
│   ├── SupplierDataPanel.tsx   # Panel upload và hiển thị dữ liệu NCC
│   ├── SystemDataPanel.tsx     # Panel hiển thị dữ liệu Wecare
│   └── ThemeToggle.tsx         # Nút chuyển đổi dark/light mode
│
├── hooks/              # Custom React hooks
│   ├── useAuth.ts              # Quản lý authentication token
│   ├── useMappings.ts          # Quản lý SKU mappings
│   ├── useSuppliers.ts         # Quản lý danh sách nhà cung cấp
│   └── useSystemData.ts        # Quản lý dữ liệu từ Dynamics CRM
│
├── services/           # Business logic services
│   └── geminiService.ts        # Tích hợp Gemini AI
│
├── utils/              # Helper functions
│   ├── apiHelpers.ts           # API error handling utilities
│   └── reconciliationHelpers.ts # Logic đối chiếu dữ liệu
│
├── App.tsx             # Main application component
├── types.ts            # TypeScript type definitions
├── constants.ts        # App constants (API URLs, etc.)
└── index.tsx           # Entry point

```

## 🎯 Mục Đích Tái Cấu Trúc

### Trước đây
- Tất cả logic trong một file `App.tsx` (~600+ dòng)
- Khó bảo trì, khó test
- Code bị lặp lại nhiều

### Sau khi tái cấu trúc
- ✅ Tách biệt concerns (UI, logic, data fetching)
- ✅ Dễ dàng test từng phần riêng biệt
- ✅ Reusable components và hooks
- ✅ Code dễ đọc, dễ maintain

## 📦 Chi Tiết Các Module

### Components (`/components`)

Chứa các React components thuần túy, chỉ nhận props và render UI.

**AppHeader.tsx**
- Hiển thị header với dropdown chọn nhà cung cấp
- Tích hợp ThemeToggle
- Có search/filter cho danh sách NCC

**SupplierDataPanel.tsx**
- Panel upload file từ nhà cung cấp
- Hiển thị danh sách file đã upload
- Tích hợp date picker
- Gọi AI để đọc file

**ErrorModal.tsx** & **ErrorAlert.tsx**
- Hiển thị lỗi từ AI response
- Cho phép xem raw data khi parsing thất bại

### Hooks (`/hooks`)

Custom hooks quản lý state và side effects.

**useAuth.ts**
```typescript
// Quản lý authentication
const { accessToken, fetchAccessToken } = useAuth();
```

**useSuppliers.ts**
```typescript
// Quản lý danh sách nhà cung cấp
const { 
  suppliers, 
  selectedSupplierId, 
  setSelectedSupplierId, 
  fetchSuppliers 
} = useSuppliers();
```

**useSystemData.ts**
```typescript
// Fetch dữ liệu từ Dynamics CRM
const { 
  systemData, 
  setSystemData, 
  fetchSystemData 
} = useSystemData();
```

**useMappings.ts**
```typescript
// Quản lý SKU mappings
const { 
  existingMappings, 
  fetchExistingMappings, 
  saveMappings 
} = useMappings();
```

### Utils (`/utils`)

Helper functions không liên quan đến React.

**apiHelpers.ts**
- `getApiErrorMessage()`: Parse error message từ API response

**reconciliationHelpers.ts**
- `calculateValidDates()`: Tính toán ngày hợp lệ từ data
- `calculateDateRange()`: Tính khoảng thời gian ±10 ngày
- `flattenSupplierItems()`: Flatten dữ liệu items
- `preprocessItemsWithMappings()`: Xử lý trước dữ liệu với mappings có sẵn
- `findSkuMappings()`: Tìm các SKU mappings mới

### Services (`/services`)

Business logic và external API integrations.

**geminiService.ts**
- Tích hợp Google Gemini AI
- Extract data từ file (Excel, PDF, images)
- Reconcile data giữa NCC và Wecare
- Analyze feedback

## 🔄 Data Flow

```
1. App.tsx khởi tạo
   ↓
2. useAuth → Lấy access token
   ↓
3. useSuppliers → Load danh sách NCC
   ↓
4. User chọn NCC và upload file
   ↓
5. geminiService → Extract data từ file
   ↓
6. useSystemData → Fetch data từ Wecare
   ↓
7. useMappings → Load existing mappings
   ↓
8. reconciliationHelpers → Preprocessing
   ↓
9. geminiService → AI reconciliation
   ↓
10. ReconciliationResultDisplay → Hiển thị kết quả
```

## 🛠️ Maintenance Guide

### Thêm Component Mới
```bash
# Tạo file trong /components
touch components/MyNewComponent.tsx
```

```typescript
// Template
import React from 'react';

interface MyNewComponentProps {
  // định nghĩa props
}

const MyNewComponent: React.FC<MyNewComponentProps> = (props) => {
  return (
    // JSX
  );
};

export default MyNewComponent;
```

### Thêm Hook Mới
```bash
# Tạo file trong /hooks
touch hooks/useMyFeature.ts
```

```typescript
// Template
import { useState, useCallback } from 'react';

export const useMyFeature = () => {
  const [data, setData] = useState(null);

  const fetchData = useCallback(async () => {
    // logic
  }, []);

  return { data, fetchData };
};
```

### Thêm Utility Function
```bash
# Thêm vào file phù hợp trong /utils
```

```typescript
// Export function
export const myUtilFunction = (param: any) => {
  // logic
  return result;
};
```

## 🧪 Testing Strategy

### Components
- Test rendering với different props
- Test user interactions
- Snapshot testing cho UI

### Hooks
- Test với React Testing Library
- Test async operations
- Test error handling

### Utils
- Unit tests cho pure functions
- Edge cases testing

## 📝 Coding Standards

### Naming Conventions
- **Components**: PascalCase (`AppHeader.tsx`)
- **Hooks**: camelCase với prefix `use` (`useAuth.ts`)
- **Utils**: camelCase (`apiHelpers.ts`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### File Organization
- Một component/hook/util per file
- Export default cho components
- Named exports cho hooks và utils

### Type Safety
- Luôn định nghĩa TypeScript types
- Sử dụng interfaces cho props
- Avoid `any` type khi có thể

## 🚀 Performance Optimization

- **Hooks**: Sử dụng `useCallback` để memoize functions
- **Components**: Xem xét `React.memo` cho heavy components
- **Data**: Xử lý lớn trong workers nếu cần

## 🔐 Security Considerations

- API keys trong environment variables
- Không commit sensitive data
- Validate user input
- Sanitize data trước khi gửi lên server

## 📚 Resources

- [React Hooks Documentation](https://react.dev/reference/react)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Clean Code Principles](https://github.com/ryanmcdermott/clean-code-javascript)
