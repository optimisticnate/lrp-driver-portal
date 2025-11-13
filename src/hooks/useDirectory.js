/* Proprietary and confidential. See LICENSE. */

/**
 * useDirectory Hook
 *
 * Custom hook for managing directory contacts with real-time Firestore sync
 */

import { useState, useEffect, useMemo, useCallback } from "react";

import {
  subscribeDirectory,
  createContact,
  updateContact,
  deleteContact,
} from "@/services/directoryService";
import { useAuth } from "@/context/AuthContext";
import { useSnack } from "@/components/feedback/SnackbarProvider";

export function useDirectory({ activeOnly = true } = {}) {
  const { user } = useAuth();
  const snack = useSnack();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to directory contacts
  useEffect(() => {
    const unsubscribe = subscribeDirectory({
      activeOnly,
      onData: (data) => {
        setContacts(data);
        setLoading(false);
        setError(null);
      },
      onError: (err) => {
        setError(err);
        setLoading(false);
      },
    });

    return () => unsubscribe();
  }, [activeOnly]);

  /**
   * Add a new contact
   */
  const addContact = useCallback(
    async (contactData) => {
      if (!user?.uid) {
        snack.show("You must be logged in to add contacts", "error");
        return;
      }

      setIsSubmitting(true);
      try {
        await createContact(contactData, user.uid);
        snack.show("Contact added successfully", "success");
      } catch (err) {
        snack.show("Failed to add contact: " + err.message, "error");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, snack],
  );

  /**
   * Edit an existing contact
   */
  const editContact = useCallback(
    async (id, updates) => {
      if (!user?.uid) {
        snack.show("You must be logged in to edit contacts", "error");
        return;
      }

      setIsSubmitting(true);
      try {
        await updateContact(id, updates, user.uid);
        snack.show("Contact updated successfully", "success");
      } catch (err) {
        snack.show("Failed to update contact: " + err.message, "error");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, snack],
  );

  /**
   * Remove a contact
   */
  const removeContact = useCallback(
    async (id) => {
      if (!user?.uid) {
        snack.show("You must be logged in to delete contacts", "error");
        return;
      }

      setIsSubmitting(true);
      try {
        await deleteContact(id);
        snack.show("Contact deleted successfully", "success");
      } catch (err) {
        snack.show("Failed to delete contact: " + err.message, "error");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, snack],
  );

  /**
   * Get contacts by escalation tier
   */
  const getContactsByTier = useCallback(
    (tier) => {
      return contacts.filter((contact) => contact.escalationTier === tier);
    },
    [contacts],
  );

  /**
   * Get contacts grouped by tier
   */
  const contactsByTier = useMemo(() => {
    return {
      tier1: contacts.filter((c) => c.escalationTier === 1), // Owner
      tier2: contacts.filter((c) => c.escalationTier === 2), // Driver
      tier3: contacts.filter((c) => c.escalationTier === 3), // Dispatcher
      tier4: contacts.filter((c) => c.escalationTier === 4), // CDL Trainer
    };
  }, [contacts]);

  return {
    contacts,
    loading,
    error,
    isSubmitting,
    addContact,
    editContact,
    removeContact,
    getContactsByTier,
    contactsByTier,
  };
}
