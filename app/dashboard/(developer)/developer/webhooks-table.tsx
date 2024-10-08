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
  LogsIcon,
  MoreVerticalIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { Webhook } from "@prisma/client";
import { useWebhooksStore } from "@/lib/store";
import DeleteWebhooModal from "@/components/modals/webhooks/delete-webhook-modal";
import CreateWebhookModal from "@/components/modals/webhooks/create-webhook-modal";
import Link from "next/link";

const INITIAL_VISIBLE_COLUMNS = [
  "name",
  "url",
  "eventType",
  "createdAt",
  "actions",
];

export default function WebhooksTable({
  webhooks,
  refetch,
}: {
  webhooks: Webhook[];
  refetch: () => void;
}) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onOpenChange: onDeleteModalOpenChange,
  } = useDisclosure();
  const setDeleteWebhook = useWebhooksStore((state) => state.setDeleteWebhook);
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
    let filteredWebhooks = [...webhooks];

    if (hasSearchFilter) {
      filteredWebhooks = filteredWebhooks.filter((user) =>
        user.name.toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    return filteredWebhooks;
  }, [webhooks, filterValue, statusFilter]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);

  const items = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return filteredItems.slice(start, end);
  }, [page, filteredItems, rowsPerPage]);

  const renderCell = React.useCallback((webhook: Webhook, columnKey: Key) => {
    // @ts-expect-error - Fix this
    const cellValue = webhook[columnKey];

    if (cellValue instanceof Date) {
      return cellValue;
    }
    switch (columnKey) {
      case "eventType":
        return (
          <Chip color="primary" size="sm">
            {cellValue.replace("-", " ")}
          </Chip>
        );
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
                startContent={<LogsIcon size={14} />}
                key="logs"
                as={Link}
                href={`/dashboard/developer/${webhook.id}`}
              >
                View logs
              </DropdownItem>
              <DropdownItem
                startContent={<Trash2Icon size={14} />}
                key="delete"
                className="text-danger"
                color="danger"
                onClick={() => {
                  setDeleteWebhook(webhook);
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
  }, []);

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
          <Button
            startContent={<PlusIcon />}
            color="primary"
            onClick={() => onOpen()}
          >
            Create webhook
          </Button>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-default-400 text-small">
            Total {webhooks.length} webhooks
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
    webhooks.length,
    onSearchChange,
    hasSearchFilter,
  ]);

  const bottomContent = React.useMemo(() => {
    if (webhooks.length === 0) {
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
        <TableBody emptyContent={"No webhooks found"} items={items}>
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => (
                <TableCell>{renderCell(item, columnKey)}</TableCell>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>
      <CreateWebhookModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onOpen={onOpen}
        onModalClose={refetch}
      />
      <DeleteWebhooModal
        isOpen={isDeleteModalOpen}
        onOpenChange={onDeleteModalOpenChange}
        onOpen={onDeleteModalOpen}
        onModalClose={refetch}
      />
    </>
  );
}
