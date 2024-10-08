"use client";
import React, { Key } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Pagination,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  useDisclosure,
  Chip,
} from "@nextui-org/react";
import { columns } from "./data";
import {
  CheckCircle2Icon,
  ClipboardCopyIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import CreatePaymentLinkModal from "@/components/modals/payment-links/create-payment-link-modal";
import DeletePaymentLinkModal from "@/components/modals/payment-links/delete-payment-link-modal";
import { usePaymentLinksStore } from "@/lib/store";
import { PaymentLink, Product, User } from "@prisma/client";

const INITIAL_VISIBLE_COLUMNS = [
  "name",
  "slug",
  "paymentLink",
  "product",
  "requiresWorldId",
  "createdAt",
  "actions",
];

type PaymentLinkWithUserAndProduct = PaymentLink & {
  user: User;
  product: Product;
};

export default function LinksTable({
  links,
  refetch,
}: {
  links: PaymentLinkWithUserAndProduct[];
  refetch: () => void;
}) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onOpenChange: onDeleteModalOpenChange,
  } = useDisclosure();
  const setDeletePaymentLink = usePaymentLinksStore(
    (state) => state.setDeletePaymentLink
  );
  const [filterValue, setFilterValue] = React.useState("");
  const [visibleColumns] = React.useState(new Set(INITIAL_VISIBLE_COLUMNS));
  const [statusFilter] = React.useState("all");
  const [rowsPerPage, setRowsPerPage] = React.useState(5);
  const [page, setPage] = React.useState(1);

  const hasSearchFilter = Boolean(filterValue);

  const headerColumns = React.useMemo(() => {
    return columns.filter((column) =>
      Array.from(visibleColumns).includes(column.uid)
    );
  }, [visibleColumns]);

  const filteredItems = React.useMemo(() => {
    let filteredpaymentLinks = [...links];

    if (hasSearchFilter) {
      filteredpaymentLinks = filteredpaymentLinks.filter((user) =>
        user.name.toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    return filteredpaymentLinks;
  }, [links, filterValue, statusFilter]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);

  const items = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return filteredItems.slice(start, end);
  }, [page, filteredItems, rowsPerPage]);

  const renderCell = React.useCallback(
    (
      paymentLink: PaymentLink & { user: User; product: Product },
      columnKey: Key
    ) => {
      // @ts-expect-error - Fix this
      const cellValue = paymentLink[columnKey];
      if (cellValue instanceof Date) {
        return cellValue;
      }
      switch (columnKey) {
        case "name":
          return <span className="font-bold">{cellValue}</span>;
        case "requiresWorldId":
          return cellValue ? (
            <CheckCircle2Icon className="text-emerald-500" />
          ) : (
            <XCircleIcon className="text-red-500" />
          );
        case "slug":
          return (
            <Chip
              className="cursor-pointer bg-blue-400 text-white font-bold"
              onClick={() => {
                if (navigator && navigator.clipboard) {
                  navigator.clipboard.writeText(
                    `${paymentLink.slug}.fluxlink.eth.limo`
                  );
                }
              }}
              size="sm"
            >
              {cellValue}.fluxlink.eth
            </Chip>
          );
        case "product":
          return paymentLink.product.name;
        case "actions":
          return (
            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly variant="light" size="sm">
                  <MoreVerticalIcon size={14} />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Static Actions">
                <DropdownItem
                  startContent={<ClipboardCopyIcon size={14} />}
                  key="clipboard"
                  onClick={() => {
                    if (navigator && navigator.clipboard) {
                      navigator.clipboard.writeText(
                        `${paymentLink.slug}.fluxlink.eth.limo`
                      );
                    }
                  }}
                >
                  Copy to clipboard
                </DropdownItem>
                <DropdownItem
                  startContent={<PencilIcon size={14} />}
                  key="edit"
                >
                  Edit
                </DropdownItem>
                <DropdownItem
                  startContent={<Trash2Icon size={14} />}
                  key="delete"
                  className="text-danger"
                  color="danger"
                  onClick={() => {
                    setDeletePaymentLink(paymentLink);
                    onDeleteModalOpen();
                  }}
                >
                  Delete
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          );
        default:
          return cellValue;
      }
    },
    []
  );

  const onRowsPerPageChange = React.useCallback((e: unknown) => {
    // @ts-expect-error - Fix this
    setRowsPerPage(Number(e.target.value));
    setPage(1);
  }, []);

  const onSearchChange = React.useCallback((value: string | undefined) => {
    if (value) {
      setFilterValue(value);
      setPage(1);
    } else {
      setFilterValue("");
    }
  }, []);

  const onClear = React.useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const topContent = React.useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full sm:max-w-[44%]"
            placeholder="Search by name.."
            startContent={<SearchIcon />}
            value={filterValue}
            onClear={() => onClear()}
            onValueChange={onSearchChange}
          />
          <Button startContent={<PlusIcon />} color="primary" onClick={onOpen}>
            Create link
          </Button>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-default-400 text-small">
            Total {links.length} links
          </span>
          <label className="flex items-center text-default-400 text-small">
            Links per page:
            <select
              className="bg-transparent outline-none text-default-400 text-small"
              onChange={onRowsPerPageChange}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
            </select>
          </label>
        </div>
      </div>
    );
  }, [
    filterValue,
    statusFilter,
    visibleColumns,
    onRowsPerPageChange,
    links.length,
    onSearchChange,
    hasSearchFilter,
  ]);

  const bottomContent = React.useMemo(() => {
    if (links.length === 0) {
      return <div />;
    }
    return (
      <div className="py-2 px-2 flex justify-between items-center">
        <span className="w-[30%] text-small text-default-400"></span>
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={page}
          total={pages}
          onChange={setPage}
        />
        <div className="hidden sm:flex w-[30%] justify-end gap-2"></div>
      </div>
    );
  }, [items.length, page, pages, hasSearchFilter]);

  return (
    <>
      <Table
        aria-label="Example table with custom cells, pagination and sorting"
        isHeaderSticky
        bottomContent={bottomContent}
        bottomContentPlacement="outside"
        classNames={{
          wrapper: "max-h-[382px]",
        }}
        topContent={topContent}
        topContentPlacement="outside"
      >
        <TableHeader columns={headerColumns}>
          {(column) => (
            <TableColumn
              key={column.uid}
              align={column.uid === "actions" ? "center" : "start"}
              // allowsSorting={column.sortable}
            >
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody emptyContent={"No links found"} items={items}>
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => (
                <TableCell>{renderCell(item, columnKey)}</TableCell>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>
      <CreatePaymentLinkModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onOpen={onOpen}
        onModalClose={refetch}
      />
      <DeletePaymentLinkModal
        isOpen={isDeleteModalOpen}
        onOpenChange={onDeleteModalOpenChange}
        onOpen={onDeleteModalOpen}
        onModalClose={refetch}
      />
    </>
  );
}
