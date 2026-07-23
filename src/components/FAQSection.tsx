import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  {
    q: "How quickly will I receive a response?",
    a: "Our team reviews all tickets within 2 business hours. For urgent issues, we prioritize them immediately and aim to respond within 30 minutes.",
  },
  {
    q: "What information should I include in my ticket?",
    a: "Please include a clear description of the issue, any relevant URLs or page links, screenshots if applicable, and steps to reproduce the problem. The more detail you provide, the faster we can help.",
  },
  {
    q: "Can I track the status of my ticket?",
    a: "Yes! After submitting a ticket, you'll receive a confirmation with a reference number. Our admin team tracks all tickets through our internal dashboard and will keep you updated via email.",
  },
  {
    q: "What types of issues can I report?",
    a: "You can report incidents, service requests, password/account issues, network problems, hardware failures, software bugs, and more. Use the category dropdown to classify your issue.",
  },
  {
    q: "How do I upload documents or screenshots?",
    a: "In the ticket form, use the file upload area to drag and drop or browse for files. We support images (PNG, JPG), PDFs, Word documents, Excel files, and text files up to 10MB each.",
  },
  {
    q: "Can I use the AI assistant instead of the form?",
    a: "Absolutely! Click the chat icon in the bottom corner to talk with our AI support assistant. It will help you describe your issue, gather all necessary details, and create a ticket draft you can review before submitting.",
  },
];

export function FAQSection() {
  return (
    <section className="py-16 lg:py-20 bg-muted/30">
      <div className="container max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Frequently Asked Questions
          </h2>
          <div className="mt-3 mx-auto h-0.5 w-12 rounded-full bg-gradient-gold" />
        </motion.div>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <AccordionItem
                value={`faq-${i}`}
                className="rounded-lg border bg-card px-5 shadow-card transition-shadow hover:shadow-elevated"
              >
                <AccordionTrigger className="text-left font-medium text-sm hover:no-underline py-4 hover:text-primary transition-colors">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
