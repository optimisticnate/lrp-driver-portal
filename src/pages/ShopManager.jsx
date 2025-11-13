/* Proprietary and confidential. See LICENSE. */
import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
} from "@mui/material";
import { ShoppingCart, Visibility, Refresh, Search } from "@mui/icons-material";

import { ordersService } from "../services/ordersService";

function TabPanel({ children, value, index, ...other }) {
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ShopManager() {
  const [tabValue, setTabValue] = useState(0);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Stats
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    shippedOrders: 0,
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await ordersService.getAll({ limit: 100 });
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = useCallback(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (sum, order) => sum + (order.total || 0),
      0,
    );
    const pendingOrders = orders.filter(
      (o) => o.status === "pending" || o.status === "processing",
    ).length;
    const shippedOrders = orders.filter(
      (o) => o.status === "shipped" || o.status === "delivered",
    ).length;

    setStats({ totalOrders, totalRevenue, pendingOrders, shippedOrders });
  }, [orders]);

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const success = await ordersService.updateStatus(orderId, newStatus);

      if (success) {
        setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));

        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
        }
      }
    } catch (error) {
      console.error("Error updating order:", error);
    }
  };

  const handleAddTrackingNumber = async (orderId, trackingNumber) => {
    try {
      const success = await ordersService.updateTracking(orderId, trackingNumber);

      if (success) {
        setOrders(orders.map((o) =>
          o.id === orderId ? { ...o, tracking_number: trackingNumber, status: "shipped" } : o
        ));

        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, tracking_number: trackingNumber, status: "shipped" });
        }
      }
    } catch (error) {
      console.error("Error adding tracking number:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "warning";
      case "processing":
        return "info";
      case "shipped":
        return "primary";
      case "delivered":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      (order.order_number || "").toLowerCase().includes(searchLower) ||
      (order.customer_email || "").toLowerCase().includes(searchLower) ||
      (order.customer_name || "").toLowerCase().includes(searchLower);

    return matchesStatus && matchesSearch;
  });

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: "bold" }}>
          <ShoppingCart sx={{ mr: 2, verticalAlign: "middle" }} />
          Shop Manager
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchOrders}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Orders
              </Typography>
              <Typography
                variant="h4"
                sx={{ color: "success.main", fontWeight: "bold" }}
              >
                {stats.totalOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Revenue
              </Typography>
              <Typography
                variant="h4"
                sx={{ color: "success.main", fontWeight: "bold" }}
              >
                ${stats.totalRevenue.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Pending Orders
              </Typography>
              <Typography
                variant="h4"
                sx={{ color: "warning.main", fontWeight: "bold" }}
              >
                {stats.pendingOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Shipped Orders
              </Typography>
              <Typography
                variant="h4"
                sx={{ color: "info.main", fontWeight: "bold" }}
              >
                {stats.shippedOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Orders" />
          <Tab label="Products" />
        </Tabs>
      </Paper>

      {/* Orders Tab */}
      <TabPanel value={tabValue} index={0}>
        {/* Filters */}
        <Box sx={{ mb: 3, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flexGrow: 1, maxWidth: 400 }}
            InputProps={{
              startAdornment: (
                <Search sx={{ mr: 1, color: "text.secondary" }} />
              ),
            }}
          />

          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="processing">Processing</MenuItem>
            <MenuItem value="shipped">Shipped</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </TextField>
        </Box>

        {/* Orders Table */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredOrders.length === 0 ? (
          <Alert severity="info">No orders found</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Order #</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Customer</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Date</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Items</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Total</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Status</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Actions</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>{order.order_number || order.id}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {order.customer_name || "N/A"}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {order.customer_email || "N/A"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>{order.items?.length || 0}</TableCell>
                    <TableCell>
                      <Typography
                        sx={{ fontWeight: "bold", color: "success.main" }}
                      >
                        ${(order.total || 0).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.status || "pending"}
                        color={getStatusColor(order.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedOrder(order);
                          setOrderDialogOpen(true);
                        }}
                      >
                        <Visibility />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Products Tab */}
      <TabPanel value={tabValue} index={1}>
        <Alert severity="info">
          Products are managed in Payload CMS. Access at:{" "}
          <a
            href="http://localhost:3001/admin"
            target="_blank"
            rel="noopener noreferrer"
          >
            Payload Admin
          </a>
        </Alert>
      </TabPanel>

      {/* Order Detail Dialog */}
      <OrderDetailDialog
        order={selectedOrder}
        open={orderDialogOpen}
        onClose={() => setOrderDialogOpen(false)}
        onUpdateStatus={handleUpdateOrderStatus}
        onAddTracking={handleAddTrackingNumber}
      />
    </Container>
  );
}

// Order Detail Dialog Component
function OrderDetailDialog({
  order,
  open,
  onClose,
  onUpdateStatus,
  onAddTracking,
}) {
  const [newStatus, setNewStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  useEffect(() => {
    if (order) {
      // Initialize form state from order data
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewStatus(order.status || "pending");

      setTrackingNumber(order.tracking_number || "");
    }
  }, [order]);

  if (!order) return null;

  const shippingAddress = order.shippingAddress || {};

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Order Details - {order.order_number || order.id}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Customer Info */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Customer Information
            </Typography>
            <Typography>
              <strong>Name:</strong> {order.customer_name || "N/A"}
            </Typography>
            <Typography>
              <strong>Email:</strong> {order.customer_email || "N/A"}
            </Typography>
          </Grid>

          {/* Shipping Address */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Shipping Address
            </Typography>
            {shippingAddress.line1 ? (
              <>
                <Typography>{shippingAddress.line1}</Typography>
                {shippingAddress.line2 && (
                  <Typography>{shippingAddress.line2}</Typography>
                )}
                <Typography>
                  {shippingAddress.city}, {shippingAddress.state}{" "}
                  {shippingAddress.postal_code}
                </Typography>
              </>
            ) : (
              <Typography color="textSecondary">No address on file</Typography>
            )}
          </Grid>

          {/* Order Items */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Order Items
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>Product</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Variant</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Qty</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Price</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(order.items || []).map((item, index) => (
                    <TableRow
                      key={`${item.product_name}-${item.variant_name}-${index}`}
                    >
                      <TableCell>
                        {item.product_name || item.product?.name || "N/A"}
                      </TableCell>
                      <TableCell>{item.variant_name || "N/A"}</TableCell>
                      <TableCell align="right">{item.quantity || 0}</TableCell>
                      <TableCell align="right">
                        ${((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ mt: 2, textAlign: "right" }}>
              <Typography variant="h6" sx={{ color: "success.main" }}>
                Total: ${(order.total || 0).toFixed(2)}
              </Typography>
            </Box>
          </Grid>

          {/* Status Update */}
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label="Order Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="shipped">Shipped</MenuItem>
              <MenuItem value="delivered">Delivered</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
            <Button
              variant="contained"
              color="success"
              fullWidth
              sx={{ mt: 1 }}
              onClick={() => {
                onUpdateStatus(order.id, newStatus);
                onClose();
              }}
              disabled={newStatus === order.status}
            >
              Update Status
            </Button>
          </Grid>

          {/* Tracking Number */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Tracking Number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking number"
            />
            <Button
              variant="outlined"
              fullWidth
              sx={{ mt: 1 }}
              onClick={() => {
                if (trackingNumber) {
                  onAddTracking(order.id, trackingNumber);
                  onClose();
                }
              }}
              disabled={
                !trackingNumber || trackingNumber === order.tracking_number
              }
            >
              Add Tracking
            </Button>
          </Grid>

          {/* Printify Info */}
          {order.printify_order_id && (
            <Grid item xs={12}>
              <Alert severity="info">
                <strong>Printify Order ID:</strong> {order.printify_order_id}
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
