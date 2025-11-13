/* Proprietary and confidential. See LICENSE. */
import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  Typography,
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
  Stack,
  InputAdornment,
} from "@mui/material";
import {
  CardGiftcard,
  Visibility,
  Add,
  Refresh,
  Search,
  ContentCopy,
} from "@mui/icons-material";

import { giftCardsService } from "../services/giftCardsService";
import { useSnack } from "../components/feedback/SnackbarProvider.jsx";

export default function GiftCardManager() {
  const [giftCards, setGiftCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { show } = useSnack();

  // Stats
  const [stats, setStats] = useState({
    totalCards: 0,
    totalValue: 0,
    activeCards: 0,
    redeemedValue: 0,
  });

  const fetchGiftCards = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await giftCardsService.getAll({ limit: 100 });
      setGiftCards(data);
    } catch (error) {
      console.error("Error fetching gift cards:", error);
      show("Failed to load gift cards", "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  const calculateStats = useCallback(() => {
    const totalCards = giftCards.length;
    const totalValue = giftCards.reduce(
      (sum, card) => sum + (card.initial_amount || 0),
      0,
    );
    const activeCards = giftCards.filter((c) => c.status === "active").length;
    const redeemedValue = giftCards.reduce((sum, card) => {
      return sum + ((card.initial_amount || 0) - (card.current_balance || 0));
    }, 0);

    setStats({ totalCards, totalValue, activeCards, redeemedValue });
  }, [giftCards]);

  useEffect(() => {
    fetchGiftCards();
  }, [fetchGiftCards]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const handleUpdateCardStatus = async (cardId, newStatus) => {
    try {
      await giftCardsService.updateStatus(cardId, newStatus);

      setGiftCards(
        giftCards.map((c) =>
          c.id === cardId ? { ...c, status: newStatus } : c,
        ),
      );

      if (selectedCard?.id === cardId) {
        setSelectedCard({ ...selectedCard, status: newStatus });
      }

      show("Gift card status updated", "success");
    } catch (error) {
      console.error("Error updating gift card:", error);
      show("Failed to update gift card", "error");
    }
  };

  const handleCreateGiftCard = async (cardData) => {
    try {
      const newCard = await giftCardsService.create({
        code: cardData.code || generateGiftCardCode(),
        initial_amount: parseFloat(cardData.initialValue),
        recipient_email: cardData.recipientEmail || "",
        recipient_name: cardData.recipientName || "",
        purchaser_name: cardData.senderName || "",
        purchaser_email: "",
        message: cardData.message || "",
        type: "digital",
        delivery_method: "immediate",
      });

      if (newCard) {
        setGiftCards([newCard, ...giftCards]);
        show("Gift card created successfully", "success");
        setCreateDialogOpen(false);
      }
    } catch (error) {
      console.error("Error creating gift card:", error);
      show("Failed to create gift card", "error");
    }
  };

  const generateGiftCardCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) code += "-";
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "redeemed":
        return "default";
      case "expired":
        return "warning";
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    show("Copied to clipboard", "success");
  };

  const filteredCards = giftCards.filter((card) => {
    const matchesStatus =
      statusFilter === "all" || card.status === statusFilter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      (card.code || "").toLowerCase().includes(searchLower) ||
      (card.recipient_email || "").toLowerCase().includes(searchLower) ||
      (card.recipient_name || "").toLowerCase().includes(searchLower) ||
      (card.purchaser_name || "").toLowerCase().includes(searchLower);

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
          <CardGiftcard sx={{ mr: 2, verticalAlign: "middle" }} />
          Gift Card Manager
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            color="success"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Gift Card
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchGiftCards}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Gift Cards
              </Typography>
              <Typography
                variant="h4"
                sx={{ color: "success.main", fontWeight: "bold" }}
              >
                {stats.totalCards}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Value
              </Typography>
              <Typography
                variant="h4"
                sx={{ color: "success.main", fontWeight: "bold" }}
              >
                ${stats.totalValue.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Cards
              </Typography>
              <Typography
                variant="h4"
                sx={{ color: "info.main", fontWeight: "bold" }}
              >
                {stats.activeCards}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Redeemed Value
              </Typography>
              <Typography
                variant="h4"
                sx={{ color: "warning.main", fontWeight: "bold" }}
              >
                ${stats.redeemedValue.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Box sx={{ mb: 3, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <TextField
          placeholder="Search gift cards..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ flexGrow: 1, maxWidth: 400 }}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: "text.secondary" }} />,
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
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="redeemed">Redeemed</MenuItem>
          <MenuItem value="expired">Expired</MenuItem>
          <MenuItem value="cancelled">Cancelled</MenuItem>
        </TextField>
      </Box>

      {/* Gift Cards Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredCards.length === 0 ? (
        <Alert severity="info">No gift cards found</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>Code</strong>
                </TableCell>
                <TableCell>
                  <strong>Recipient</strong>
                </TableCell>
                <TableCell>
                  <strong>From</strong>
                </TableCell>
                <TableCell>
                  <strong>Created</strong>
                </TableCell>
                <TableCell>
                  <strong>Balance</strong>
                </TableCell>
                <TableCell>
                  <strong>Initial Value</strong>
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
              {filteredCards.map((card) => (
                <TableRow key={card.id} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "monospace" }}
                      >
                        {card.code || "N/A"}
                      </Typography>
                      {card.code && (
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(card.code)}
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {card.recipient_name || "N/A"}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {card.recipient_email || "N/A"}
                    </Typography>
                  </TableCell>
                  <TableCell>{card.purchaser_name || "N/A"}</TableCell>
                  <TableCell>
                    {card.created_at
                      ? new Date(card.created_at).toLocaleDateString()
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Typography
                      sx={{ fontWeight: "bold", color: "success.main" }}
                    >
                      ${(card.current_balance || 0).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography color="textSecondary">
                      ${(card.initial_amount || 0).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={card.status || "active"}
                      color={getStatusColor(card.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedCard(card);
                        setCardDialogOpen(true);
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

      {/* Gift Card Detail Dialog */}
      <GiftCardDetailDialog
        card={selectedCard}
        open={cardDialogOpen}
        onClose={() => setCardDialogOpen(false)}
        onUpdateStatus={handleUpdateCardStatus}
        onCopyCode={copyToClipboard}
        onCardUpdated={(updatedCard) => {
          // Update card in the list
          setGiftCards(
            giftCards.map((c) => (c.id === updatedCard.id ? updatedCard : c)),
          );
          // Update selected card
          setSelectedCard(updatedCard);
        }}
      />

      {/* Create Gift Card Dialog */}
      <CreateGiftCardDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreateGiftCard}
      />
    </Container>
  );
}

// Gift Card Detail Dialog Component
// allow-color-literal-file - Premium brand-specific design with LRP color palette
function GiftCardDetailDialog({
  card,
  open,
  onClose,
  onUpdateStatus,
  onCopyCode,
  onCardUpdated,
}) {
  const [newStatus, setNewStatus] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const { show } = useSnack();

  useEffect(() => {
    if (card) {
      // Initialize form state from card data
      setNewStatus(card.status || "active");
      setRedeemAmount("");
    }
  }, [card]);

  const handleRedeem = async () => {
    const amount = parseFloat(redeemAmount);
    if (!amount || amount <= 0) {
      show("Please enter a valid amount", "error");
      return;
    }

    if (amount > card.current_balance) {
      show("Amount exceeds current balance", "error");
      return;
    }

    setRedeeming(true);
    try {
      const success = await giftCardsService.redeem(card.id, amount);
      if (success) {
        show(`Successfully redeemed $${amount.toFixed(2)}`, "success");
        setRedeemAmount("");
        // Refresh the card data
        const updatedCard = await giftCardsService.getById(card.id);
        if (updatedCard) {
          onCardUpdated(updatedCard);
        }
      } else {
        show("Failed to redeem gift card", "error");
      }
    } catch (error) {
      show(error.message || "Failed to redeem gift card", "error");
    } finally {
      setRedeeming(false);
    }
  };

  if (!card) return null;

  const usedAmount = (card.initial_amount || 0) - (card.current_balance || 0);
  const percentUsed = card.initial_amount
    ? (usedAmount / card.initial_amount) * 100
    : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "#060606",
          backgroundImage: "none",
        }
      }}
    >
      <DialogTitle sx={{ color: "#ffffff", fontWeight: 600 }}>
        Gift Card Details
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: "rgba(76, 187, 23, 0.1)" }}>
        <Grid container spacing={3}>
          {/* Gift Card Code */}
          <Grid item xs={12}>
            <Box
              sx={{
                bgcolor: "#0f0f0f",
                border: "1px solid rgba(76, 187, 23, 0.3)",
                borderRadius: 3,
                p: 2.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: 3,
                  color: "#ffffff",
                  fontWeight: 600,
                }}
              >
                {card.code || "N/A"}
              </Typography>
              {card.code && (
                <Button
                  size="small"
                  onClick={() => onCopyCode(card.code)}
                  sx={{
                    bgcolor: "transparent",
                    border: "1px solid #4cbb17",
                    color: "#4cbb17",
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    transition: "all 200ms",
                    "&:hover": {
                      bgcolor: "#4cbb17",
                      color: "#ffffff",
                    },
                  }}
                  startIcon={<ContentCopy sx={{ fontSize: 16 }} />}
                >
                  Copy
                </Button>
              )}
            </Box>
          </Grid>

          {/* Balance Info */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box
                  sx={{
                    bgcolor: "#0f0f0f",
                    border: "1px solid rgba(76, 187, 23, 0.2)",
                    borderRadius: 3,
                    p: 2.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#e6e6e6",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    Current Balance
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: "#4cbb17",
                      fontWeight: "bold",
                      mt: 1,
                    }}
                  >
                    ${(card.current_balance || 0).toFixed(2)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box
                  sx={{
                    bgcolor: "#0f0f0f",
                    border: "1px solid rgba(76, 187, 23, 0.2)",
                    borderRadius: 3,
                    p: 2.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#e6e6e6",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    Initial Value
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: "#e6e6e6",
                      fontWeight: "bold",
                      mt: 1,
                    }}
                  >
                    ${(card.initial_amount || 0).toFixed(2)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box
                  sx={{
                    bgcolor: "#0f0f0f",
                    border: "1px solid rgba(76, 187, 23, 0.2)",
                    borderRadius: 3,
                    p: 2.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#e6e6e6",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    Used Amount
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: "#999999",
                      fontWeight: "bold",
                      mt: 1,
                    }}
                  >
                    ${usedAmount.toFixed(2)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#666666",
                      fontSize: "11px",
                    }}
                  >
                    ({percentUsed.toFixed(0)}%)
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Grid>

          {/* Recipient Info */}
          <Grid item xs={12}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#999999",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontSize: "11px",
                      fontWeight: 600,
                      mb: 0.5,
                    }}
                  >
                    Recipient Name
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: "#ffffff",
                      fontWeight: 500,
                      fontSize: "15px",
                    }}
                  >
                    {card.recipient_name || "N/A"}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#999999",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontSize: "11px",
                      fontWeight: 600,
                      mb: 0.5,
                    }}
                  >
                    Recipient Email
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: "#ffffff",
                      fontWeight: 500,
                      fontSize: "15px",
                    }}
                  >
                    {card.recipient_email || "N/A"}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#999999",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontSize: "11px",
                      fontWeight: 600,
                      mb: 0.5,
                    }}
                  >
                    From
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: "#ffffff",
                      fontWeight: 500,
                      fontSize: "15px",
                    }}
                  >
                    {card.purchaser_name || "N/A"}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Grid>

          {/* Message */}
          {card.message && (
            <Grid item xs={12}>
              <Box
                sx={{
                  bgcolor: "#0f0f0f",
                  borderLeft: "3px solid #4cbb17",
                  borderRadius: 2,
                  p: 2.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: "#4cbb17",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    letterSpacing: 1,
                    fontSize: "11px",
                    display: "block",
                    mb: 1,
                  }}
                >
                  Message
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "#e6e6e6",
                    fontStyle: "italic",
                    lineHeight: 1.6,
                    fontSize: "14px",
                  }}
                >
                  &ldquo;{card.message}&rdquo;
                </Typography>
              </Box>
            </Grid>
          )}

          {/* Redeem Gift Card */}
          {card.status === "active" && card.current_balance > 0 && (
            <Grid item xs={12}>
              <Box
                sx={{
                  background: "linear-gradient(135deg, rgba(76, 187, 23, 0.1) 0%, rgba(76, 187, 23, 0.05) 100%)",
                  border: "1px solid rgba(76, 187, 23, 0.3)",
                  borderRadius: 4,
                  p: 4,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    color: "#ffffff",
                    fontWeight: 600,
                    mb: 3,
                    fontSize: "18px",
                  }}
                >
                  Redeem Gift Card
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ position: "relative" }}>
                    <TextField
                      type="number"
                      fullWidth
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      placeholder="0.00"
                      inputProps={{
                        min: 0,
                        max: card.current_balance,
                        step: 0.01,
                        style: {
                          paddingLeft: "40px",
                        },
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          bgcolor: "#060606",
                          border: "2px solid rgba(76, 187, 23, 0.3)",
                          borderRadius: 3,
                          fontSize: "24px",
                          fontWeight: "bold",
                          color: "#ffffff",
                          transition: "all 200ms",
                          "&:hover": {
                            borderColor: "rgba(76, 187, 23, 0.5)",
                          },
                          "&.Mui-focused": {
                            borderColor: "#4cbb17",
                            boxShadow: "0 0 0 4px rgba(76, 187, 23, 0.1)",
                          },
                          "& fieldset": {
                            border: "none",
                          },
                        },
                        "& .MuiOutlinedInput-input": {
                          py: 2,
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment
                            position="start"
                            sx={{
                              position: "absolute",
                              left: 20,
                              color: "#4cbb17",
                              fontSize: "24px",
                              fontWeight: "bold",
                            }}
                          >
                            $
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#999999",
                        mt: 1,
                        display: "block",
                        fontSize: "12px",
                      }}
                    >
                      Max: ${(card.current_balance || 0).toFixed(2)}
                    </Typography>
                  </Box>
                  <Button
                    fullWidth
                    onClick={handleRedeem}
                    disabled={
                      redeeming ||
                      !redeemAmount ||
                      parseFloat(redeemAmount) <= 0 ||
                      parseFloat(redeemAmount) > card.current_balance
                    }
                    sx={{
                      bgcolor: "#4cbb17",
                      color: "#ffffff",
                      borderRadius: 3,
                      py: 2.25,
                      fontSize: "18px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      transition: "all 300ms",
                      "&:hover": {
                        bgcolor: "#3a8e11",
                        transform: "translateY(-2px)",
                        boxShadow: "0 8px 24px rgba(76, 187, 23, 0.4)",
                      },
                      "&:active": {
                        transform: "translateY(0)",
                      },
                      "&.Mui-disabled": {
                        bgcolor: "#333333",
                        color: "#666666",
                      },
                    }}
                  >
                    {redeeming ? (
                      <CircularProgress size={24} sx={{ color: "#ffffff" }} />
                    ) : (
                      `Redeem $${redeemAmount || "0.00"}`
                    )}
                  </Button>
                  <Box
                    sx={{
                      bgcolor: "rgba(76, 187, 23, 0.1)",
                      border: "1px solid rgba(76, 187, 23, 0.3)",
                      borderRadius: 2,
                      p: 1.5,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        color: "#4cbb17",
                        fontSize: "18px",
                        lineHeight: 1,
                      }}
                    >
                      ℹ
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#e6e6e6",
                        lineHeight: 1.5,
                        fontSize: "13px",
                      }}
                    >
                      This will deduct the amount from the gift card balance. Once
                      redeemed, this action cannot be undone.
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          )}

          {/* Transaction History */}
          <Grid item xs={12}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
              <Typography
                variant="h6"
                sx={{
                  color: "#ffffff",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  fontSize: "16px",
                }}
              >
                Transaction History
              </Typography>
            </Box>
            {card.transactions && card.transactions.length > 0 ? (
              <TableContainer
                component={Paper}
                sx={{
                  bgcolor: "#0f0f0f",
                  border: "1px solid rgba(76, 187, 23, 0.1)",
                  borderRadius: 3,
                  backgroundImage: "none",
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "#999999", fontWeight: 600, borderColor: "rgba(255, 255, 255, 0.05)" }}>
                        Date
                      </TableCell>
                      <TableCell sx={{ color: "#999999", fontWeight: 600, borderColor: "rgba(255, 255, 255, 0.05)" }}>
                        Type
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#999999", fontWeight: 600, borderColor: "rgba(255, 255, 255, 0.05)" }}>
                        Amount
                      </TableCell>
                      <TableCell sx={{ color: "#999999", fontWeight: 600, borderColor: "rgba(255, 255, 255, 0.05)" }}>
                        Order
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {card.transactions.map((txn, index) => (
                      <TableRow
                        key={`${txn.date}-${txn.orderId}-${index}`}
                        sx={{
                          "&:hover": {
                            bgcolor: "rgba(76, 187, 23, 0.05)",
                          },
                        }}
                      >
                        <TableCell sx={{ color: "#e6e6e6", borderColor: "rgba(255, 255, 255, 0.05)" }}>
                          {txn.date
                            ? new Date(txn.date).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell sx={{ color: "#e6e6e6", borderColor: "rgba(255, 255, 255, 0.05)" }}>
                          {txn.type || "N/A"}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: "#4cbb17",
                            fontWeight: "bold",
                            fontSize: "16px",
                            borderColor: "rgba(255, 255, 255, 0.05)",
                          }}
                        >
                          ${(txn.amount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ color: "#e6e6e6", borderColor: "rgba(255, 255, 255, 0.05)" }}>
                          {txn.orderId || "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box
                sx={{
                  bgcolor: "#0f0f0f",
                  border: "1px dashed rgba(76, 187, 23, 0.2)",
                  borderRadius: 3,
                  p: 5,
                  textAlign: "center",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "48px",
                    color: "#333333",
                    mb: 2,
                  }}
                >
                  📋
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "#999999",
                    fontSize: "14px",
                  }}
                >
                  No transactions yet
                </Typography>
              </Box>
            )}
          </Grid>

          {/* Status Update */}
          <Grid item xs={12}>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                alignItems: "center",
                pt: 3,
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: "#e6e6e6",
                  fontWeight: 500,
                  minWidth: "120px",
                }}
              >
                Gift Card Status
              </Typography>
              <TextField
                select
                fullWidth
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "#060606",
                    border: "1px solid rgba(76, 187, 23, 0.3)",
                    borderRadius: 2,
                    color: "#ffffff",
                    "& fieldset": {
                      border: "none",
                    },
                    "&:hover": {
                      borderColor: "rgba(76, 187, 23, 0.5)",
                    },
                    "&.Mui-focused": {
                      borderColor: "#4cbb17",
                    },
                  },
                  "& .MuiSelect-select": {
                    py: 1.5,
                  },
                }}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="redeemed">Redeemed</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
              <Button
                onClick={() => {
                  onUpdateStatus(card.id, newStatus);
                  onClose();
                }}
                disabled={newStatus === card.status}
                sx={{
                  bgcolor: "transparent",
                  border: "1px solid #4cbb17",
                  color: "#4cbb17",
                  px: 3,
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  transition: "all 200ms",
                  whiteSpace: "nowrap",
                  "&:hover": {
                    bgcolor: "#4cbb17",
                    color: "#ffffff",
                  },
                  "&.Mui-disabled": {
                    border: "1px solid #333333",
                    color: "#666666",
                  },
                }}
              >
                Update Status
              </Button>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ borderColor: "rgba(76, 187, 23, 0.1)", bgcolor: "#060606" }}>
        <Button
          onClick={onClose}
          sx={{
            color: "#e6e6e6",
            "&:hover": {
              bgcolor: "rgba(76, 187, 23, 0.1)",
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Create Gift Card Dialog Component
function CreateGiftCardDialog({ open, onClose, onCreate }) {
  const [formData, setFormData] = useState({
    initialValue: "",
    recipientName: "",
    recipientEmail: "",
    senderName: "",
    message: "",
    customCode: false,
    code: "",
  });

  const handleSubmit = () => {
    if (!formData.initialValue || parseFloat(formData.initialValue) <= 0) {
      return;
    }

    onCreate({
      ...formData,
      code: formData.customCode ? formData.code : undefined,
    });

    // Reset form
    setFormData({
      initialValue: "",
      recipientName: "",
      recipientEmail: "",
      senderName: "",
      message: "",
      customCode: false,
      code: "",
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Gift Card</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Gift Card Value"
            type="number"
            required
            fullWidth
            value={formData.initialValue}
            onChange={(e) =>
              setFormData({ ...formData, initialValue: e.target.value })
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">$</InputAdornment>
              ),
            }}
          />

          <TextField
            label="Recipient Name"
            fullWidth
            value={formData.recipientName}
            onChange={(e) =>
              setFormData({ ...formData, recipientName: e.target.value })
            }
          />

          <TextField
            label="Recipient Email"
            type="email"
            fullWidth
            value={formData.recipientEmail}
            onChange={(e) =>
              setFormData({ ...formData, recipientEmail: e.target.value })
            }
          />

          <TextField
            label="Sender Name"
            fullWidth
            value={formData.senderName}
            onChange={(e) =>
              setFormData({ ...formData, senderName: e.target.value })
            }
          />

          <TextField
            label="Personal Message"
            multiline
            rows={3}
            fullWidth
            value={formData.message}
            onChange={(e) =>
              setFormData({ ...formData, message: e.target.value })
            }
            placeholder="Add a personal message (optional)"
          />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2">Use Custom Code</Typography>
            <input
              type="checkbox"
              checked={formData.customCode}
              onChange={(e) =>
                setFormData({ ...formData, customCode: e.target.checked })
              }
            />
          </Box>

          {formData.customCode && (
            <TextField
              label="Custom Gift Card Code"
              fullWidth
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
              placeholder="XXXX-XXXX-XXXX-XXXX"
              helperText="Leave empty to auto-generate"
            />
          )}

          <Alert severity="info">
            A unique gift card code will be automatically generated if you
            don&apos;t provide a custom code.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleSubmit}
          disabled={
            !formData.initialValue || parseFloat(formData.initialValue) <= 0
          }
        >
          Create Gift Card
        </Button>
      </DialogActions>
    </Dialog>
  );
}
